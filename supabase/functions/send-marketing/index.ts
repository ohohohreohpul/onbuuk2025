/**
 * Sends promotion emails (public.marketing_sends, queued by the send-marketing
 * cron job). Two modes:
 *  - batch: called by pg_cron with OUTBOX_CRON_SECRET (or the service role);
 *    claims up to BATCH_SIZE recipients and sends through the shop's provider.
 *  - test:  called by a shop admin with { campaignId, testEmail }; sends one
 *    copy to that address only.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isServiceRoleRequest } from "../_shared/emailAccess.ts";
import { authorizationErrorResponse, requireActiveAdmin } from "../_shared/adminAuthorization.ts";
import { firstNameOf, renderMarketingEmail, type MarketingShop, type MarketingVoucher } from "../_shared/marketingEmail.ts";
import { campaignToContent, loadMarketingShop, loadShopVouchers, type CampaignRow } from "../_shared/marketingData.ts";

const BATCH_SIZE = 40;
const PAUSE_BETWEEN_SENDS_MS = 600;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Campaign extends CampaignRow {
  id: string;
  business_id: string;
}

interface ShopBundle {
  shop: MarketingShop;
  vouchers: MarketingVoucher[];
}

interface ClaimedSend {
  id: string;
  campaign_id: string;
  business_id: string;
  customer_id: string;
  email: string;
}

type Outcome = "sent" | "skipped" | "retry";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isCronRequest(req: Request): boolean {
  const secret = Deno.env.get("OUTBOX_CRON_SECRET") ?? "";
  const given = req.headers.get("x-cron-secret") ?? "";
  return (secret.length >= 32 && timingSafeEqual(given, secret)) || isServiceRoleRequest(req);
}

const serviceClient = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const unsubscribeUrl = (token: string) => `${Deno.env.get("SUPABASE_URL")}/functions/v1/marketing-unsubscribe?t=${token}`;

async function loadShopBundle(supabase: SupabaseClient, businessId: string): Promise<ShopBundle> {
  const shop = await loadMarketingShop(supabase, businessId);
  return { shop, vouchers: await loadShopVouchers(supabase, businessId, shop) };
}

async function sendOne(
  supabase: SupabaseClient,
  bundle: ShopBundle,
  campaign: Campaign,
  to: { email: string; name: string | null; token: string; customerId: string | null },
): Promise<string | null> {
  const link = unsubscribeUrl(to.token);
  const { subject, html } = renderMarketingEmail(
    bundle.shop,
    campaignToContent(campaign),
    firstNameOf(to.name),
    link,
    bundle.vouchers,
  );
  const { data, error } = await supabase.functions.invoke("send-customer-email", {
    body: {
      businessId: campaign.business_id,
      toEmail: to.email,
      subject,
      body: html,
      customerId: to.customerId,
      headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    },
  });
  if (error || !data?.success) return error?.message ?? data?.error ?? "send failed";
  return null;
}

async function deliver(
  supabase: SupabaseClient,
  row: ClaimedSend,
  campaigns: Map<string, Campaign | null>,
  shops: Map<string, ShopBundle>,
): Promise<{ outcome: Outcome; note?: string }> {
  if (!campaigns.has(row.campaign_id)) {
    const { data } = await supabase.from("marketing_campaigns")
      .select("*").eq("id", row.campaign_id).maybeSingle();
    campaigns.set(row.campaign_id, (data as Campaign | null) ?? null);
  }
  const campaign = campaigns.get(row.campaign_id);
  if (!campaign) return { outcome: "skipped", note: "campaign deleted" };

  const { data: customer } = await supabase.from("customers")
    .select("name, newsletter_status, unsubscribe_token").eq("id", row.customer_id).maybeSingle();
  if (!customer) return { outcome: "skipped", note: "customer deleted" };
  if (customer.newsletter_status === "unsubscribed") return { outcome: "skipped", note: "unsubscribed" };

  if (!shops.has(row.business_id)) shops.set(row.business_id, await loadShopBundle(supabase, row.business_id));
  const failure = await sendOne(supabase, shops.get(row.business_id)!, campaign, {
    email: row.email, name: customer.name, token: customer.unsubscribe_token, customerId: row.customer_id,
  });
  return failure ? { outcome: "retry", note: failure } : { outcome: "sent" };
}

async function runBatch(): Promise<Response> {
  const supabase = serviceClient();
  const { data: claimed, error } = await supabase.rpc("claim_marketing_sends", { p_limit: BATCH_SIZE });
  if (error) {
    console.error("claim_marketing_sends failed:", error);
    return json({ error: "Could not read the send queue" }, 500);
  }

  const campaigns = new Map<string, Campaign | null>();
  const shops = new Map<string, ShopBundle>();
  const summary: Record<Outcome, number> = { sent: 0, skipped: 0, retry: 0 };
  for (const row of (claimed ?? []) as ClaimedSend[]) {
    let result: { outcome: Outcome; note?: string };
    try {
      result = await deliver(supabase, row, campaigns, shops);
    } catch (deliverError) {
      result = { outcome: "retry", note: deliverError instanceof Error ? deliverError.message : String(deliverError) };
    }
    summary[result.outcome] += 1;
    if (result.outcome === "retry") console.error(`marketing send ${row.id} failed: ${result.note}`);
    const { error: finishError } = await supabase.rpc("finish_marketing_send", {
      p_id: row.id, p_status: result.outcome, p_error: result.note ?? null,
    });
    if (finishError) console.error(`finish_marketing_send ${row.id} failed:`, finishError);
    await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_SENDS_MS));
  }
  return json({ processed: claimed?.length ?? 0, ...summary });
}

async function runTest(req: Request): Promise<Response> {
  const { campaignId, testEmail } = await req.json().catch(() => ({}));
  if (typeof campaignId !== "string" || typeof testEmail !== "string" || !EMAIL_PATTERN.test(testEmail.trim())) {
    return json({ error: "campaignId and a valid testEmail are required" }, 400);
  }
  const { businessId, supabaseAdmin } = await requireActiveAdmin(req);
  const { data: campaign } = await supabaseAdmin.from("marketing_campaigns")
    .select("*").eq("id", campaignId).maybeSingle();
  if (!campaign || campaign.business_id !== businessId) return json({ error: "Campaign not found" }, 404);

  // Test copies use a token that matches no customer, so their unsubscribe link changes nothing.
  const failure = await sendOne(supabaseAdmin, await loadShopBundle(supabaseAdmin, businessId), campaign as Campaign, {
    email: testEmail.trim(), name: null, token: crypto.randomUUID(), customerId: null,
  });
  return failure ? json({ error: failure }, 502) : json({ success: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    if (isCronRequest(req)) return await runBatch();
    return await runTest(req);
  } catch (error) {
    const denied = authorizationErrorResponse(error, corsHeaders);
    if (denied) return denied;
    console.error("send-marketing failed:", error);
    return json({ error: "Could not send the email" }, 500);
  }
});
