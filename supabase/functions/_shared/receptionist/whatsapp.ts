// WhatsApp for the AI receptionist: one interface, two connection types.
//
// cloud_api   Official WhatsApp Business Cloud API (Meta). Shop stores its
//             phone number id + permanent access token (+ app secret for
//             webhook signatures). Free-form replies within 24 h of the
//             customer's last message; outreach via approved templates.
// qr_gateway  "Own number" via an Evolution API (WhatsApp Web) gateway server:
//             WA_GATEWAY_URL, WA_GATEWAY_API_KEY, WA_GATEWAY_WEBHOOK_TOKEN.
//             Not official: outreach is throttled by warm-up caps.

const GRAPH_VERSION = "v21.0";
const REQUEST_TIMEOUT_MS = 20_000; // includes the typing delay
const WARMUP_START_CAP = 20;
const WARMUP_MAX_CAP = 200;
const WARMUP_RAMP_DAYS = 60;
/** "#test Habt ihr morgen frei?" in the shop's own chat simulates a customer. */
const TEST_PREFIX = /^\s*#test\b[\s:]*([\s\S]+)$/i;

export class WhatsappError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "WhatsappError";
  }
}

export interface InboundWhatsapp {
  messageId: string;
  from: string; // digits
  name: string | null;
  text: string;
}

export const phoneDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/** German local numbers (0151…) -> 49151…; anything else: digits as given. */
export function toWhatsappNumber(phone: string, defaultCountry = "49"): string | null {
  let digits = phoneDigits(phone.startsWith("+") ? phone.slice(1) : phone);
  if (phone.trim().startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = defaultCountry + digits.slice(1);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Daily outreach cap for a QR number: 20 on day 1, rising to 200 over 60 days. */
export function warmupCap(startedAt: string | null, now = new Date()): number {
  if (!startedAt) return WARMUP_START_CAP;
  const day = Math.max(1, Math.floor((now.getTime() - Date.parse(startedAt)) / 86_400_000) + 1);
  const progress = Math.min(day - 1, WARMUP_RAMP_DAYS - 1) / (WARMUP_RAMP_DAYS - 1);
  return Math.round(WARMUP_START_CAP + (WARMUP_MAX_CAP - WARMUP_START_CAP) * progress);
}

async function request(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const message = (data?.error?.message as string | undefined) ?? text.slice(0, 200);
      throw new WhatsappError(`WhatsApp ${response.status}: ${message}`, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof WhatsappError) throw error;
    throw new WhatsappError(error instanceof Error && error.name === "AbortError" ? "WhatsApp request timed out" : `WhatsApp request failed: ${error}`);
  } finally {
    clearTimeout(timer);
  }
}

// --- Cloud API ---------------------------------------------------------------

export async function cloudSendText(phoneNumberId: string, token: string, to: string, body: string): Promise<string | null> {
  const data = await request(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: body.slice(0, 4096) } }),
  });
  return ((data.messages as { id?: string }[] | undefined)?.[0]?.id) ?? null;
}

/** Approved template with the customer's first name as {{1}}. */
export async function cloudSendTemplate(
  phoneNumberId: string, token: string, to: string, template: string, language: string, firstName: string,
): Promise<string | null> {
  const data = await request(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: { name: template, language: { code: language }, components: [{ type: "body", parameters: [{ type: "text", text: firstName || "Hallo" }] }] },
    }),
  });
  return ((data.messages as { id?: string }[] | undefined)?.[0]?.id) ?? null;
}

/** Checks a phone number id + token pair; returns the display number. */
export async function cloudVerify(phoneNumberId: string, token: string): Promise<string> {
  const data = await request(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return String(data.display_phone_number ?? "");
}

/** Meta webhook body -> phone number id + text messages (statuses, reactions, media without caption are skipped). */
export function parseCloudWebhook(payload: unknown): { phoneNumberId: string; messages: InboundWhatsapp[] }[] {
  const out: { phoneNumberId: string; messages: InboundWhatsapp[] }[] = [];
  // deno-lint-ignore no-explicit-any
  for (const entry of (payload as any)?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      // deno-lint-ignore no-explicit-any
      const names = new Map<string, string>((value.contacts ?? []).map((c: any) => [String(c.wa_id), String(c.profile?.name ?? "")]));
      const messages: InboundWhatsapp[] = [];
      for (const m of value.messages ?? []) {
        const text = m.type === "text" ? m.text?.body
          : m.type === "button" ? m.button?.text
          : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title)
          : m.image?.caption ?? m.video?.caption ?? m.document?.caption;
        if (!m.id || !m.from || !text) continue;
        messages.push({ messageId: String(m.id), from: phoneDigits(String(m.from)), name: names.get(String(m.from)) || null, text: String(text).slice(0, 4000) });
      }
      out.push({ phoneNumberId: String(phoneNumberId), messages });
    }
  }
  return out;
}

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(rawBody, appSecret). */
export async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  return safeEqual(signature, header.slice("sha256=".length));
}

// --- QR gateway (Evolution API) ------------------------------------------------

function gateway(): { url: string; apiKey: string } {
  const url = Deno.env.get("WA_GATEWAY_URL")?.replace(/\/+$/, "");
  const apiKey = Deno.env.get("WA_GATEWAY_API_KEY");
  if (!url || !apiKey) throw new WhatsappError("The 'own number' WhatsApp gateway is not set up on this server yet.");
  return { url, apiKey };
}

export function isGatewayConfigured(): boolean {
  return Boolean(Deno.env.get("WA_GATEWAY_URL") && Deno.env.get("WA_GATEWAY_API_KEY") && Deno.env.get("WA_GATEWAY_WEBHOOK_TOKEN"));
}

const gatewayHeaders = (apiKey: string) => ({ apikey: apiKey, "Content-Type": "application/json" });

/** delayMs > 0 shows "typing…" to the customer for that long before the message arrives. */
export async function gatewaySendText(instance: string, to: string, body: string, delayMs = 0): Promise<string | null> {
  const { url, apiKey } = gateway();
  const data = await request(`${url}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST", headers: gatewayHeaders(apiKey),
    body: JSON.stringify({ number: to, text: body.slice(0, 4096), ...(delayMs > 0 ? { delay: delayMs } : {}) }),
  });
  return ((data.key as { id?: string } | undefined)?.id) ?? null;
}

/** Creates (or reconnects) the shop's instance and returns a pairing QR as data URL. */
export async function gatewayConnect(instance: string, webhookUrl: string): Promise<string | null> {
  const { url, apiKey } = gateway();
  const token = Deno.env.get("WA_GATEWAY_WEBHOOK_TOKEN") ?? "";
  try {
    const data = await request(`${url}/instance/create`, {
      method: "POST",
      headers: gatewayHeaders(apiKey),
      body: JSON.stringify({
        instanceName: instance, integration: "WHATSAPP-BAILEYS", qrcode: true,
        webhook: { url: webhookUrl, headers: { "x-zenno-webhook-token": token }, events: ["QRCODE_UPDATED", "MESSAGES_UPSERT", "CONNECTION_UPDATE"] },
      }),
    });
    // deno-lint-ignore no-explicit-any
    return ((data as any).qrcode?.base64 ?? (data as any).base64 ?? null) as string | null;
  } catch (error) {
    if (!(error instanceof WhatsappError) || !(error.status === 403 || error.status === 409 || /exist/i.test(error.message))) throw error;
    const data = await request(`${url}/instance/connect/${encodeURIComponent(instance)}`, { headers: gatewayHeaders(apiKey) });
    // deno-lint-ignore no-explicit-any
    return ((data as any).base64 ?? (data as any).qrcode?.base64 ?? null) as string | null;
  }
}

export async function gatewayDisconnect(instance: string): Promise<void> {
  const { url, apiKey } = gateway();
  await request(`${url}/instance/logout/${encodeURIComponent(instance)}`, { method: "DELETE", headers: gatewayHeaders(apiKey) }).catch(() => ({}));
  await request(`${url}/instance/delete/${encodeURIComponent(instance)}`, { method: "DELETE", headers: gatewayHeaders(apiKey) }).catch(() => ({}));
}

export type GatewayEvent =
  | { kind: "message"; instance: string; message: InboundWhatsapp }
  | { kind: "connection"; instance: string; state: "open" | "close" | "connecting"; phone: string | null }
  | { kind: "qr"; instance: string; qr: string | null }
  | { kind: "self_test"; instance: string; message: InboundWhatsapp }
  | { kind: "ignore" };

/** Evolution webhook body -> events (groups, own messages and non-text messages are ignored). */
export function parseGatewayWebhook(payload: unknown): GatewayEvent[] {
  // deno-lint-ignore no-explicit-any
  const p = payload as any;
  const event = String(p?.event ?? "").toLowerCase().replace(/_/g, ".");
  const instance = String(p?.instance ?? "");
  if (!instance) return [{ kind: "ignore" }];
  if (event === "connection.update") {
    const state = p.data?.state ?? p.data?.connection;
    const phone = typeof p.data?.wuid === "string" ? phoneDigits(p.data.wuid.split("@")[0]) : null;
    return [{ kind: "connection", instance, state: state === "open" ? "open" : state === "close" ? "close" : "connecting", phone }];
  }
  if (event === "qrcode.updated") return [{ kind: "qr", instance, qr: p.data?.qrcode?.base64 ?? p.data?.base64 ?? null }];
  if (event !== "messages.upsert") return [{ kind: "ignore" }];
  const items = Array.isArray(p.data) ? p.data : [p.data];
  // deno-lint-ignore no-explicit-any
  // The shop's own number (Evolution puts the instance owner in "sender").
  const owner = typeof p.sender === "string" ? phoneDigits(p.sender.split("@")[0]) : "";
  return items.flatMap((d: any): GatewayEvent[] => {
    const key = d?.key ?? {};
    const jids = [key.remoteJid, key.remoteJidAlt, key.senderPn, d?.senderPn].filter((j): j is string => typeof j === "string");
    // Newer WhatsApp may address a chat by a hidden id (…@lid); the phone number then sits in remoteJidAlt/senderPn.
    const phoneJid = jids.find((j) => j.endsWith("@s.whatsapp.net"));
    const lidJid = jids.find((j) => j.endsWith("@lid"));
    if (!phoneJid && !lidJid) return []; // groups, broadcasts, status
    const text = d.message?.conversation ?? d.message?.extendedTextMessage?.text ?? d.message?.imageMessage?.caption ?? d.message?.videoMessage?.caption;
    if (!text || !key.id) return [];
    const from = phoneJid ? phoneDigits(phoneJid.split("@")[0]) : lidJid!; // a bare lid jid is still a valid reply address
    if (key.fromMe) {
      // Own messages are ignored – except "#test …" in the shop's "Message yourself" chat.
      const test = TEST_PREFIX.exec(String(text));
      const isOwnChat = (owner && from === owner) || (!phoneJid && Boolean(lidJid));
      return test && isOwnChat
        ? [{ kind: "self_test", instance, message: { messageId: String(key.id), from: owner || from, name: null, text: test[1].slice(0, 4000) } }]
        : [];
    }
    return [{ kind: "message", instance, message: { messageId: String(key.id), from, name: d.pushName ?? null, text: String(text).slice(0, 4000) } }];
  });
}

/** Shape of a skipped event for diagnostics: no text, no numbers. */
export function describeSkippedEvent(payload: unknown): Record<string, unknown> {
  // deno-lint-ignore no-explicit-any
  const p = payload as any;
  const d = Array.isArray(p?.data) ? p.data[0] : p?.data;
  const domain = (j: unknown) => (typeof j === "string" ? j.split("@")[1] ?? "none" : null);
  return {
    event: p?.event ?? null,
    remoteJid: domain(d?.key?.remoteJid), remoteJidAlt: domain(d?.key?.remoteJidAlt), senderPn: domain(d?.key?.senderPn ?? d?.senderPn),
    fromMe: d?.key?.fromMe ?? null, hasSender: typeof p?.sender === "string",
    messageKeys: d?.message ? Object.keys(d.message).slice(0, 6) : [], messageType: d?.messageType ?? null,
  };
}

export function gatewayTokenMatches(header: string | null): boolean {
  const token = Deno.env.get("WA_GATEWAY_WEBHOOK_TOKEN") ?? "";
  return token.length >= 16 && safeEqual(header ?? "", token);
}
