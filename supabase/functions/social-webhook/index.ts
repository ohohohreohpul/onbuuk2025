import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { handleInbound } from "../_shared/receptionist/agent.ts";
import { upsertConversation, updateConversation } from "../_shared/receptionist/conversations.ts";
import { makeDeliver } from "../_shared/receptionist/deliver.ts";
import type { ReceptionistSettings } from "../_shared/receptionist/shopContext.ts";
import { parseReviewWebhook, type ReviewWebhookEvent } from "../_shared/social/gbp.ts";
import { autoReplyIfEligible, loadGbpSettings, upsertReview } from "../_shared/social/gbpService.ts";
import { zernioConnectionOf } from "../_shared/social/zernioClient.ts";
import { isEventForRoute, webhookRoute, type WebhookRoute } from "../_shared/social/zernioConnection.ts";
import {
  parseZernioEvent, verifyZernioSignature, type SocialAccountEvent, type SocialMessageEvent,
} from "../_shared/social/zernioWebhook.ts";

// Zernio webhook. Zenno's own Zernio account posts to /social-webhook (secret
// ZERNIO_WEBHOOK_SECRET); a shop's own Zernio account posts to /social-webhook?c=<connection>
// (secret in Vault). An event only ever reaches a shop that belongs to the account it came from.
//   message.received      Instagram / Facebook DM -> AI receptionist -> reply via Zernio
//                         (only while the shop has the Social plan)
//   account.connected     mirror the account into social_accounts
//   account.disconnected  mark it inactive
//   review.new / review.updated / review.restored
//                         Google review -> gbp_reviews, auto-reply 4–5 stars if the shop
//                         switched it on (only with local SEO)
// Answers 200 right away; the agent runs in the background (Zernio retries slow webhooks).

type Client = ReturnType<typeof publicServiceClient>;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const ok = () => new Response("ok", { status: 200 });

/** Which shop owns the account: the mirrored row, else the profile's externalId. */
async function ownerOf(supabase: Client, accountId: string, businessIdHint: string | null): Promise<string | null> {
  const { data } = await supabase.from("social_accounts").select("business_id").eq("zernio_account_id", accountId).maybeSingle();
  if (data?.business_id) return data.business_id as string;
  if (!businessIdHint) return null;
  const { data: profile } = await supabase.from("social_profiles").select("business_id").eq("business_id", businessIdHint).maybeSingle();
  return (profile?.business_id as string | undefined) ?? null;
}

/** The owning shop, but only if it belongs to the Zernio account the event came from. */
async function shopFor(supabase: Client, route: WebhookRoute, accountId: string, businessIdHint: string | null): Promise<string | null> {
  const businessId = await ownerOf(supabase, accountId, businessIdHint);
  if (!businessId) return null;
  const connection = await zernioConnectionOf(supabase, businessId);
  if (isEventForRoute(route, connection?.connectionId ?? null)) return businessId;
  console.warn(`social-webhook: account ${accountId} event came from another Zernio account than shop ${businessId} uses`);
  return null;
}

/** Signing secret for the route: Zenno's, or the shop's own connection's. */
async function secretFor(supabase: Client, route: WebhookRoute): Promise<string> {
  if (route.kind === "platform") return Deno.env.get("ZERNIO_WEBHOOK_SECRET") ?? "";
  if (route.kind === "invalid") return "";
  const { data, error } = await supabase.rpc("zernio_connection_secret", { p_connection_id: route.connectionId });
  if (error) throw new Error(`webhook secret lookup failed: ${error.message}`);
  return (data as { webhook_secret: string }[] | null)?.[0]?.webhook_secret ?? "";
}

async function handleAccount(supabase: Client, route: WebhookRoute, event: SocialAccountEvent): Promise<void> {
  const businessId = await shopFor(supabase, route, event.accountId, event.businessId);
  if (!businessId) {
    console.warn(`social-webhook: account ${event.accountId} belongs to no Zenno shop`);
    return;
  }
  const { error } = await supabase.from("social_accounts").upsert({
    business_id: businessId,
    zernio_account_id: event.accountId,
    platform: event.platform,
    username: event.username?.slice(0, 200) ?? null,
    display_name: event.displayName?.slice(0, 200) ?? null,
    is_active: event.connected,
    updated_at: new Date().toISOString(),
  }, { onConflict: "zernio_account_id" });
  if (error) console.error("social-webhook: account upsert failed", error);
}

async function handleMessage(supabase: Client, route: WebhookRoute, event: SocialMessageEvent): Promise<void> {
  const businessId = await shopFor(supabase, route, event.accountId, event.businessId);
  if (!businessId) {
    console.warn(`social-webhook: message for account ${event.accountId} belongs to no Zenno shop`);
    return;
  }
  const { data: hasSocial, error: planError } = await supabase.rpc("business_has_social", { p_business_id: businessId });
  if (planError) throw new Error(`plan check failed: ${planError.message}`);
  if (hasSocial !== true) {
    console.warn(`social-webhook: shop ${businessId} has no Social plan; message not answered`);
    return;
  }
  const { data } = await supabase.from("receptionist_settings").select("*").eq("business_id", businessId).maybeSingle();
  const settings = data as ReceptionistSettings | null;
  if (!settings) {
    console.warn(`social-webhook: shop ${businessId} has no receptionist settings`);
    return;
  }
  // The conversation must know its account before the agent replies through it.
  const contact = { name: event.senderName ?? (event.senderUsername ? `@${event.senderUsername}` : null) };
  const conversation = await upsertConversation(supabase, businessId, event.platform, event.conversationId, contact);
  if (conversation.external_account_id !== event.accountId) {
    await updateConversation(supabase, conversation.id, { external_account_id: event.accountId });
  }
  await handleInbound(supabase, settings, {
    channel: event.platform,
    externalId: event.conversationId,
    body: event.text,
    externalMessageId: `zernio:${event.messageId}`,
    contact,
    isVerifiedSender: false, // a social handle proves nothing about bookings or vouchers
    meta: event.senderUsername ? { username: event.senderUsername } : undefined,
  }, makeDeliver(supabase, settings));
}

async function handleReview(supabase: Client, route: WebhookRoute, event: ReviewWebhookEvent): Promise<void> {
  const { data: account } = await supabase.from("social_accounts").select("business_id")
    .eq("zernio_account_id", event.accountId).eq("platform", "googlebusiness").maybeSingle();
  const owner = account?.business_id as string | undefined;
  const businessId = owner ? await shopFor(supabase, route, event.accountId, owner) : null;
  if (!businessId) {
    console.warn(`social-webhook: review for account ${event.accountId} belongs to no Zenno shop`);
    return;
  }
  const { data: allowed, error } = await supabase.rpc("business_has_local_seo", { p_business_id: businessId });
  if (error) throw new Error(`plan check failed: ${error.message}`);
  if (allowed !== true) return;
  const row = await upsertReview(supabase, businessId, event.accountId, event.review);
  const settings = await loadGbpSettings(supabase, businessId);
  await autoReplyIfEligible(supabase, businessId, row, settings);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  const supabase = publicServiceClient();
  const route = webhookRoute(new URL(req.url));
  const secret = await secretFor(supabase, route);
  if (!(await verifyZernioSignature(raw, req.headers.get("x-zernio-signature"), secret))) {
    console.warn("social-webhook: bad or missing signature");
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const review = parseReviewWebhook(payload);
  if (review) {
    EdgeRuntime.waitUntil(handleReview(supabase, route, review).catch((error) => console.error("social-webhook: review failed", error)));
    return ok();
  }
  const event = parseZernioEvent(payload);
  if (event.kind === "ignore") return ok();
  const work = event.kind === "account" ? handleAccount(supabase, route, event) : handleMessage(supabase, route, event);
  EdgeRuntime.waitUntil(work.catch((error) => console.error("social-webhook: event failed", error)));
  return ok();
});
