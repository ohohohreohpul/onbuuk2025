import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { isServiceRoleRequest } from "../_shared/adminAuthorization.ts";
import { appendMessage, upsertConversation } from "../_shared/receptionist/conversations.ts";
import { getSecret } from "../_shared/receptionist/deliver.ts";
import { complete, isLlmConfigured } from "../_shared/receptionist/llm.ts";
import type { ReceptionistSettings } from "../_shared/receptionist/shopContext.ts";
import { cloudSendTemplate, gatewaySendText, warmupCap } from "../_shared/receptionist/whatsapp.ts";

// Cron (every 2 minutes): sends queued WhatsApp outreach to customers with a
// stored, unrevoked consent. Every message offers "STOP" (honoured by the
// receptionist). QR ("own number") connections are throttled by warm-up caps
// and a minimum gap; Cloud API sends approved templates only.

const CLAIM_BATCH = 3;
const QR_MIN_GAP_MS = 20_000;
const TIME_BUDGET_MS = 50_000;
const MAX_ATTEMPTS = 4;
const RETRY_MINUTES = 15;

const OPT_OUT_LINE: Record<string, string> = {
  de: "Keine Nachrichten mehr? Antworten Sie einfach STOP.",
  en: "No more messages? Just reply STOP.",
  th: "ไม่ต้องการรับข้อความอีก ตอบกลับว่า STOP",
};

type Client = ReturnType<typeof publicServiceClient>;

interface Recipient {
  id: string;
  campaign_id: string;
  business_id: string;
  customer_id: string;
  address: string;
  name: string | null;
  attempt_count: number;
}

interface Campaign {
  id: string;
  message: string;
  is_personalised: boolean;
  template_name: string | null;
  template_language: string | null;
  status: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("OUTBOX_CRON_SECRET") ?? "";
  return (secret.length >= 32 && timingSafeEqual(req.headers.get("x-cron-secret") ?? "", secret)) || isServiceRoleRequest(req);
}

const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** Template text with {name}; optionally re-worded by the AI (same facts, shorter, personal). */
async function messageFor(supabase: Client, campaign: Campaign, recipient: Recipient, language: string): Promise<string> {
  const base = campaign.message.replace(/\{name\}/gi, firstName(recipient.name) || (language === "de" ? "Hallo" : "there")).trim();
  let text = base;
  if (campaign.is_personalised && isLlmConfigured()) {
    try {
      const result = await complete([
        { role: "system", content: "Rewrite this WhatsApp message from a wellness shop to one customer: same facts, offers and links, no new claims, 2-4 short sentences, warm, same language. Reply with the message only." },
        { role: "user", content: base },
      ], []);
      text = result.message.content?.trim() || base;
      await supabase.from("receptionist_usage").insert({
        business_id: recipient.business_id, purpose: "outreach", model: result.model,
        prompt_tokens: result.usage.promptTokens, completion_tokens: result.usage.completionTokens,
      });
    } catch (error) {
      console.error("personalisation failed, sending the template text:", error);
    }
  }
  return `${text}\n\n${OPT_OUT_LINE[language] ?? OPT_OUT_LINE.de}`;
}

async function hasConsent(supabase: Client, recipient: Recipient): Promise<boolean> {
  const { data } = await supabase.from("customer_contact_consents").select("status")
    .eq("business_id", recipient.business_id).eq("customer_id", recipient.customer_id).eq("channel", "whatsapp").maybeSingle();
  return data?.status === "granted";
}

async function finish(supabase: Client, recipient: Recipient, patch: Record<string, unknown>) {
  await supabase.from("outreach_recipients").update(patch).eq("id", recipient.id);
  const { count } = await supabase.from("outreach_recipients").select("id", { count: "exact", head: true })
    .eq("campaign_id", recipient.campaign_id).in("status", ["queued", "sending"]);
  if ((count ?? 0) === 0) {
    await supabase.from("outreach_campaigns").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", recipient.campaign_id).eq("status", "sending");
  }
}

const later = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

function tomorrowMorning(): string {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(7, 0, 0, 0); // 09:00 Berlin summer time / 08:00 winter
  return next.toISOString();
}

async function sendOne(
  supabase: Client, recipient: Recipient, settingsCache: Map<string, ReceptionistSettings | null>, campaigns: Map<string, Campaign>, deadline: number,
): Promise<"sent" | "deferred"> {
  if (!settingsCache.has(recipient.business_id)) {
    const { data } = await supabase.from("receptionist_settings").select("*").eq("business_id", recipient.business_id).maybeSingle();
    settingsCache.set(recipient.business_id, data as ReceptionistSettings | null);
  }
  const settings = settingsCache.get(recipient.business_id);
  if (!campaigns.has(recipient.campaign_id)) {
    const { data } = await supabase.from("outreach_campaigns").select("id, message, is_personalised, template_name, template_language, status").eq("id", recipient.campaign_id).single();
    campaigns.set(recipient.campaign_id, data as Campaign);
  }
  const campaign = campaigns.get(recipient.campaign_id)!;

  if (!settings || !settings.is_enabled || !settings.whatsapp_enabled || settings.whatsapp_status !== "connected" || !settings.whatsapp_provider) {
    await finish(supabase, recipient, { status: "queued", next_attempt_at: later(RETRY_MINUTES), error: "Receptionist or WhatsApp is switched off / not connected" });
    return "deferred";
  }
  if (!(await hasConsent(supabase, recipient))) {
    await finish(supabase, recipient, { status: "skipped", error: "No (or revoked) WhatsApp consent" });
    return "sent";
  }

  const today = new Date().toISOString().slice(0, 10);
  if (settings.whatsapp_provider === "qr_gateway") {
    const sentToday = settings.whatsapp_bulk_date === today ? settings.whatsapp_bulk_sent : 0;
    if (sentToday >= warmupCap(settings.whatsapp_warmup_started_at)) {
      await finish(supabase, recipient, { status: "queued", next_attempt_at: tomorrowMorning(), error: "Daily warm-up limit reached" });
      return "deferred";
    }
    const lastAt = settings.whatsapp_last_bulk_at ? Date.parse(settings.whatsapp_last_bulk_at) : 0;
    const wait = lastAt + QR_MIN_GAP_MS - Date.now();
    if (Date.now() + Math.max(wait, 0) > deadline) {
      await supabase.from("outreach_recipients").update({ status: "queued", next_attempt_at: new Date(Date.now() + Math.max(wait, 0)).toISOString() }).eq("id", recipient.id);
      return "deferred";
    }
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  }

  const { data: business } = await supabase.from("businesses").select("language").eq("id", recipient.business_id).single();
  const language = business?.language ?? "de";
  // Marked as sent before sending: a crash may lose one promotional message, but never sends it twice.
  await supabase.from("outreach_recipients").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", recipient.id);
  try {
    let body: string;
    let externalId: string | null;
    if (settings.whatsapp_provider === "cloud_api") {
      if (!campaign.template_name || !settings.whatsapp_phone_number_id) throw new Error("Official WhatsApp needs an approved template for outreach");
      const token = await getSecret(supabase, recipient.business_id, "whatsapp_cloud_token");
      if (!token) throw new Error("WhatsApp token missing");
      externalId = await cloudSendTemplate(settings.whatsapp_phone_number_id, token, recipient.address, campaign.template_name, campaign.template_language ?? "de", firstName(recipient.name));
      body = `[Template ${campaign.template_name}] ${campaign.message}`;
    } else {
      body = await messageFor(supabase, campaign, recipient, language);
      externalId = await gatewaySendText(settings.whatsapp_instance ?? "", recipient.address, body);
      const sentToday = settings.whatsapp_bulk_date === today ? settings.whatsapp_bulk_sent : 0;
      const counters = { whatsapp_bulk_date: today, whatsapp_bulk_sent: sentToday + 1, whatsapp_last_bulk_at: new Date().toISOString() };
      await supabase.from("receptionist_settings").update(counters).eq("business_id", recipient.business_id);
      settingsCache.set(recipient.business_id, { ...settings, ...counters });
    }
    const conversation = await upsertConversation(supabase, recipient.business_id, "whatsapp", recipient.address, { name: recipient.name, phone: `+${recipient.address}` });
    await appendMessage(supabase, conversation, {
      direction: "out", author: "ai", body, externalId: externalId ? `wa:${externalId}` : null, meta: { kind: "outreach", campaignId: campaign.id },
    });
    await finish(supabase, recipient, { status: "sent", error: null });
    return "sent";
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    const isFinal = recipient.attempt_count >= MAX_ATTEMPTS || /template|token missing/i.test(message);
    await finish(supabase, recipient, isFinal
      ? { status: "failed", error: message, sent_at: null }
      : { status: "queued", next_attempt_at: later(RETRY_MINUTES * recipient.attempt_count), error: message, sent_at: null });
    return "sent";
  }
}

Deno.serve(async (req) => {
  if (!isAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const supabase = publicServiceClient();
  const deadline = Date.now() + TIME_BUDGET_MS;
  const settingsCache = new Map<string, ReceptionistSettings | null>();
  const campaigns = new Map<string, Campaign>();
  let processed = 0;
  while (Date.now() < deadline) {
    const { data, error } = await supabase.rpc("claim_outreach_recipients", { p_limit: CLAIM_BATCH });
    if (error) {
      console.error("receptionist-outreach: claim failed", error);
      return new Response(JSON.stringify({ error: "claim failed" }), { status: 500 });
    }
    const batch = (data ?? []) as Recipient[];
    if (batch.length === 0) break;
    for (const recipient of batch) {
      if (Date.now() > deadline) {
        // Not started: hand it back right away instead of waiting for the 5-minute recovery.
        await supabase.from("outreach_recipients").update({ status: "queued", next_attempt_at: new Date().toISOString() }).eq("id", recipient.id);
        continue;
      }
      if ((await sendOne(supabase, recipient, settingsCache, campaigns, deadline)) === "sent") processed++;
    }
  }
  return new Response(JSON.stringify({ processed }), { headers: { "Content-Type": "application/json" } });
});
