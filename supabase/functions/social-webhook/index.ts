import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { handleInbound } from "../_shared/receptionist/agent.ts";
import { upsertConversation, updateConversation } from "../_shared/receptionist/conversations.ts";
import { makeDeliver } from "../_shared/receptionist/deliver.ts";
import type { ReceptionistSettings } from "../_shared/receptionist/shopContext.ts";
import {
  parseZernioEvent, verifyZernioSignature, type SocialAccountEvent, type SocialMessageEvent,
} from "../_shared/social/zernioWebhook.ts";

// Zernio webhook (one subscription for all shops, secret ZERNIO_WEBHOOK_SECRET).
//   message.received      Instagram / Facebook DM -> AI receptionist -> reply via Zernio
//   account.connected     mirror the account into social_accounts
//   account.disconnected  mark it inactive
// Answers 200 right away; the agent runs in the background (Zernio retries slow webhooks).

type Client = ReturnType<typeof publicServiceClient>;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const ok = () => new Response("ok", { status: 200 });

/** Which shop owns the account: the mirrored row, else the profile's externalId. */
async function shopFor(supabase: Client, accountId: string, businessIdHint: string | null): Promise<string | null> {
  const { data } = await supabase.from("social_accounts").select("business_id").eq("zernio_account_id", accountId).maybeSingle();
  if (data?.business_id) return data.business_id as string;
  if (!businessIdHint) return null;
  const { data: profile } = await supabase.from("social_profiles").select("business_id").eq("business_id", businessIdHint).maybeSingle();
  return (profile?.business_id as string | undefined) ?? null;
}

async function handleAccount(supabase: Client, event: SocialAccountEvent): Promise<void> {
  const businessId = await shopFor(supabase, event.accountId, event.businessId);
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

async function handleMessage(supabase: Client, event: SocialMessageEvent): Promise<void> {
  const businessId = await shopFor(supabase, event.accountId, event.businessId);
  if (!businessId) {
    console.warn(`social-webhook: message for account ${event.accountId} belongs to no Zenno shop`);
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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const raw = await req.text();
  const secret = Deno.env.get("ZERNIO_WEBHOOK_SECRET") ?? "";
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

  const supabase = publicServiceClient();
  const event = parseZernioEvent(payload);
  if (event.kind === "ignore") return ok();
  const work = event.kind === "account" ? handleAccount(supabase, event) : handleMessage(supabase, event);
  EdgeRuntime.waitUntil(work.catch((error) => console.error("social-webhook: event failed", error)));
  return ok();
});
