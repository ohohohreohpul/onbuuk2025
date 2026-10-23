import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { handleInbound } from "../_shared/receptionist/agent.ts";
import { clientIp, withinLimit } from "../_shared/receptionist/limits.ts";
import { loadMarketingShop } from "../_shared/marketingData.ts";
import type { ReceptionistSettings } from "../_shared/receptionist/shopContext.ts";

// Public API of the website chat widget (public/receptionist-widget.js).
//   GET  ?key=wc_…                      -> widget config (shop name, greeting, colour)
//   GET  ?key=wc_…&visitor=…&after=ISO  -> messages for this visitor (staff replies arrive this way)
//   POST { key, visitor, message, name? } -> stores the message, returns the AI reply
// The key only identifies the shop; it grants nothing beyond this chat.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const KEY = /^wc_[a-f0-9]{32}$/;
const VISITOR = /^v_[a-f0-9]{32}$/; // 128-bit random id from the widget
const MAX_MESSAGE_CHARS = 1500;
const MAX_PER_VISITOR_PER_MINUTE = 6;
const MAX_PER_IP_PER_HOUR = 40;
const MAX_PER_SHOP_PER_HOUR = 400;
const MAX_POLLS_PER_IP_PER_MINUTE = 40;
const POLL_LIMIT = 50;

type Client = ReturnType<typeof publicServiceClient>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function settingsByKey(supabase: Client, key: string): Promise<ReceptionistSettings | null> {
  if (!KEY.test(key)) return null;
  const { data } = await supabase.from("receptionist_settings").select("*").eq("widget_key", key).maybeSingle();
  const settings = data as ReceptionistSettings | null;
  return settings?.is_enabled && settings.web_enabled ? settings : null;
}

/** Atomic counters (database): per visitor, per IP and per shop. */
async function isRateLimited(supabase: Client, businessId: string, visitor: string, ip: string): Promise<boolean> {
  const results = await Promise.all([
    withinLimit(supabase, `chat-visitor:${businessId}:${visitor}`, 60, MAX_PER_VISITOR_PER_MINUTE),
    withinLimit(supabase, `chat-ip:${businessId}:${ip}`, 3600, MAX_PER_IP_PER_HOUR),
    withinLimit(supabase, `chat-shop:${businessId}`, 3600, MAX_PER_SHOP_PER_HOUR),
  ]);
  return results.some((ok) => !ok);
}

async function config(supabase: Client, settings: ReceptionistSettings) {
  const shop = await loadMarketingShop(supabase, settings.business_id);
  return {
    shop: shop.name,
    // A picture chosen for the chat (e.g. a team member) wins over the logo.
    logo: settings.widget_avatar_url ?? shop.logoUrl ?? null,
    assistant: settings.assistant_name,
    greeting: settings.widget_greeting || null,
    color: settings.widget_color ?? shop.primaryColor ?? "#1A1714",
    language: shop.language,
  };
}

async function messagesFor(supabase: Client, settings: ReceptionistSettings, visitor: string, after: string | null) {
  const { data: conversation } = await supabase.from("receptionist_conversations").select("id")
    .eq("business_id", settings.business_id).eq("channel", "web").eq("external_id", visitor).maybeSingle();
  if (!conversation) return [];
  let query = supabase.from("receptionist_messages").select("id, direction, author, body, created_at")
    .eq("conversation_id", conversation.id).eq("status", "sent").neq("author", "system").order("created_at").limit(POLL_LIMIT);
  if (after && !Number.isNaN(Date.parse(after))) query = query.gt("created_at", after);
  const { data } = await query;
  return (data ?? []).map((m) => ({ id: m.id, from: m.direction === "in" ? "visitor" : m.author, text: m.body, at: m.created_at }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supabase = publicServiceClient();
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const settings = await settingsByKey(supabase, url.searchParams.get("key") ?? "");
      if (!settings) return json({ error: "This chat is not available." }, 404);
      const visitor = url.searchParams.get("visitor");
      if (!visitor) return json(await config(supabase, settings));
      if (!VISITOR.test(visitor)) return json({ error: "Invalid visitor" }, 400);
      if (!(await withinLimit(supabase, `chat-poll:${clientIp(req)}`, 60, MAX_POLLS_PER_IP_PER_MINUTE))) return json({ error: "Too many requests" }, 429);
      return json({ messages: await messagesFor(supabase, settings, visitor, url.searchParams.get("after")) });
    }
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => null) as { key?: string; visitor?: string; message?: string; name?: string } | null;
    const settings = await settingsByKey(supabase, body?.key ?? "");
    if (!settings) return json({ error: "This chat is not available." }, 404);
    const visitor = body?.visitor ?? "";
    const message = (body?.message ?? "").trim().slice(0, MAX_MESSAGE_CHARS);
    if (!VISITOR.test(visitor) || !message) return json({ error: "visitor and message are required" }, 400);

    if (await isRateLimited(supabase, settings.business_id, visitor, clientIp(req))) {
      return json({ error: "Too many messages — please wait a moment." }, 429);
    }

    const result = await handleInbound(supabase, settings, {
      channel: "web", externalId: visitor, body: message, contact: { name: typeof body?.name === "string" ? body.name.slice(0, 80) : null },
    }, async () => ({}));
    const reply = result.reply?.status === "sent" ? { id: result.reply.id, text: result.reply.body, at: result.reply.created_at } : null;
    return json({ reply, waitingForTeam: !reply });
  } catch (error) {
    console.error("receptionist-chat failed:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
