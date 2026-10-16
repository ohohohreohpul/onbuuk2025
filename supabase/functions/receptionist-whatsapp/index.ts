import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { handleInbound } from "../_shared/receptionist/agent.ts";
import { getSecret, makeDeliver } from "../_shared/receptionist/deliver.ts";
import type { ReceptionistSettings } from "../_shared/receptionist/shopContext.ts";
import {
  describeSkippedEvent, gatewayTokenMatches, parseCloudWebhook, parseGatewayWebhook, verifyMetaSignature, type InboundWhatsapp,
} from "../_shared/receptionist/whatsapp.ts";

// WhatsApp webhooks for the AI receptionist.
//   GET  ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…   Meta verification
//   POST (Meta Cloud API)   X-Hub-Signature-256 checked with the shop's app secret
//                           (or the platform's WHATSAPP_APP_SECRET)
//   POST ?provider=qr       Evolution gateway, header x-zenno-webhook-token
// Answers 200 right away; the agent runs in the background (providers retry slow webhooks).

type Client = ReturnType<typeof publicServiceClient>;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const ok = () => new Response("ok", { status: 200 });

async function handleMessages(supabase: Client, settings: ReceptionistSettings, messages: InboundWhatsapp[]) {
  const deliver = makeDeliver(supabase, settings);
  for (const message of messages) {
    try {
      await handleInbound(supabase, settings, {
        channel: "whatsapp",
        externalId: message.from,
        body: message.text,
        externalMessageId: `wa:${message.messageId}`,
        contact: { name: message.name, phone: `+${message.from}` },
        isVerifiedSender: true, // the number comes from WhatsApp itself
      }, deliver);
    } catch (error) {
      console.error("receptionist-whatsapp: message failed", error);
    }
  }
}

async function cloudWebhook(supabase: Client, req: Request): Promise<Response> {
  const raw = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const signature = req.headers.get("x-hub-signature-256");
  const work: Promise<void>[] = [];
  for (const group of parseCloudWebhook(payload)) {
    if (group.messages.length === 0) continue;
    const { data } = await supabase.from("receptionist_settings").select("*").eq("whatsapp_phone_number_id", group.phoneNumberId).maybeSingle();
    const settings = data as ReceptionistSettings | null;
    if (!settings || settings.whatsapp_provider !== "cloud_api") continue;
    const appSecret = (await getSecret(supabase, settings.business_id, "whatsapp_app_secret")) ?? Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
    if (!(await verifyMetaSignature(raw, signature, appSecret))) {
      console.warn(`receptionist-whatsapp: bad signature for ${group.phoneNumberId}`);
      return new Response("Invalid signature", { status: 401 });
    }
    work.push(handleMessages(supabase, settings, group.messages));
  }
  if (work.length) EdgeRuntime.waitUntil(Promise.all(work));
  return ok();
}

async function gatewayWebhook(supabase: Client, req: Request): Promise<Response> {
  if (!gatewayTokenMatches(req.headers.get("x-zenno-webhook-token"))) return new Response("Unauthorized", { status: 401 });
  const payload = await req.json().catch(() => null);
  const events = parseGatewayWebhook(payload);
  // Temporary diagnostics: message events that produced nothing (shape only, no content).
  const eventName = String((payload as { event?: string } | null)?.event ?? "").toLowerCase().replace(/_/g, ".");
  if (eventName === "messages.upsert" && events.length === 0) {
    const instance = String((payload as { instance?: string } | null)?.instance ?? "");
    const { data: owner } = await supabase.from("receptionist_settings").select("business_id").eq("whatsapp_instance", instance).maybeSingle();
    if (owner) {
      const { error } = await supabase.from("agent_events").insert({
        business_id: owner.business_id, agent_key_id: null, action: "receptionist_wa_skipped", result: "skipped",
        payload: describeSkippedEvent(payload),
      });
      if (error) console.error("diagnostic insert failed", error);
    }
  }
  for (const event of events) {
    if (event.kind === "ignore") continue;
    const { data } = await supabase.from("receptionist_settings").select("*").eq("whatsapp_instance", event.instance).maybeSingle();
    const settings = data as ReceptionistSettings | null;
    if (!settings) continue;
    if (event.kind === "qr") {
      await supabase.from("receptionist_settings").update({ whatsapp_status: "pending_qr", whatsapp_qr: event.qr }).eq("business_id", settings.business_id);
    } else if (event.kind === "connection") {
      const isOpen = event.state === "open";
      const isNewNumber = isOpen && event.phone && event.phone !== (settings.whatsapp_display_phone ?? "").replace(/\D/g, "");
      await supabase.from("receptionist_settings").update({
        whatsapp_status: isOpen ? "connected" : event.state === "close" ? "disconnected" : settings.whatsapp_status,
        ...(isOpen ? { whatsapp_qr: null } : {}),
        ...(isOpen && event.phone ? { whatsapp_display_phone: `+${event.phone}` } : {}),
        ...(isNewNumber || (isOpen && !settings.whatsapp_warmup_started_at) ? { whatsapp_warmup_started_at: new Date().toISOString() } : {}),
      }).eq("business_id", settings.business_id);
    } else if (event.kind === "message" && settings.whatsapp_provider === "qr_gateway") {
      EdgeRuntime.waitUntil(handleMessages(supabase, settings, [event.message]));
    } else if (event.kind === "self_test" && settings.whatsapp_provider === "qr_gateway") {
      // The parser only emits self_test for the shop's own chat (#test prefix, fromMe).
      EdgeRuntime.waitUntil(handleMessages(supabase, settings, [{ ...event.message, name: "Test" }]));
    }
  }
  return ok();
}

Deno.serve(async (req) => {
  const supabase = publicServiceClient();
  const url = new URL(req.url);
  try {
    if (req.method === "GET") {
      const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
      if (url.searchParams.get("hub.mode") === "subscribe" && verifyToken.length >= 16 && url.searchParams.get("hub.verify_token") === verifyToken) {
        return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    return url.searchParams.get("provider") === "qr" ? await gatewayWebhook(supabase, req) : await cloudWebhook(supabase, req);
  } catch (error) {
    console.error("receptionist-whatsapp failed:", error);
    return ok(); // never make the provider retry into the same failure
  }
});
