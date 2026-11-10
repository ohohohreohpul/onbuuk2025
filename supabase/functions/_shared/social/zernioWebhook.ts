/**
 * Zernio webhooks: signature check and the few events Zenno acts on.
 * Pure (Web Crypto only), so it runs in Deno and in the vitest suite.
 *
 * Zernio signs the raw body with HMAC-SHA256 (X-Zernio-Signature) when the
 * subscription has a secret. The event id (X-Zernio-Event-Id / payload.id) is the
 * dedupe key; message ids dedupe again in receptionist_messages.
 */

export type SocialPlatform = "instagram" | "facebook";
export const SOCIAL_PLATFORMS: SocialPlatform[] = ["instagram", "facebook"];
export const isSocialPlatform = (value: unknown): value is SocialPlatform =>
  typeof value === "string" && (SOCIAL_PLATFORMS as string[]).includes(value);

const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(raw: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
}

const MIN_SECRET_LENGTH = 32;

/** Accepts "<hex>" or "sha256=<hex>". An unset or short secret never verifies. */
export async function verifyZernioSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || secret.length < MIN_SECRET_LENGTH) return false;
  const given = header.trim().replace(/^sha256=/i, "").toLowerCase();
  return timingSafeEqual(given, await signPayload(raw, secret));
}

export interface SocialAccountEvent {
  kind: "account";
  connected: boolean;
  businessId: string | null;
  profileId: string | null;
  accountId: string;
  platform: SocialPlatform;
  username: string | null;
  displayName: string | null;
}

export interface SocialMessageEvent {
  kind: "message";
  businessId: string | null;
  accountId: string;
  platform: SocialPlatform;
  conversationId: string;
  messageId: string;
  text: string;
  senderId: string;
  senderName: string | null;
  senderUsername: string | null;
}

export type SocialEvent = SocialAccountEvent | SocialMessageEvent | { kind: "ignore"; reason: string };

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === "object" && !Array.isArray(value) ? value as Json : {});
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT_LENGTH = 4000;

/** Our business id from profiles[0].externalId (set when Zenno created the profile). */
function businessIdOf(payload: Json): string | null {
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  const externalId = str(obj(profiles[0]).externalId);
  return externalId && UUID.test(externalId) ? externalId : null;
}

export function parseZernioEvent(payload: unknown): SocialEvent {
  const body = obj(payload);
  const event = str(body.event) ?? "";
  const account = obj(body.account);
  const platform = str(account.platform) ?? str(obj(body.message).platform);
  if (!isSocialPlatform(platform)) return { kind: "ignore", reason: `platform ${platform ?? "none"}` };
  const accountId = str(account.accountId) ?? str(account.id);
  if (!accountId) return { kind: "ignore", reason: "no account id" };

  if (event === "account.connected" || event === "account.disconnected") {
    return {
      kind: "account",
      connected: event === "account.connected",
      businessId: businessIdOf(body),
      profileId: str(account.profileId),
      accountId,
      platform,
      username: str(account.username),
      displayName: str(account.displayName),
    };
  }

  if (event !== "message.received") return { kind: "ignore", reason: `event ${event || "none"}` };
  const message = obj(body.message);
  if (str(message.direction) && str(message.direction) !== "incoming" && str(message.direction) !== "inbound") {
    return { kind: "ignore", reason: "outgoing message" };
  }
  const metadata = obj(body.metadata);
  const text = str(message.text) ?? str(metadata.quickReplyPayload) ?? str(metadata.postbackTitle);
  const conversationId = str(message.conversationId) ?? str(obj(body.conversation).id);
  const messageId = str(message.id) ?? str(message.platformMessageId);
  const sender = obj(message.sender);
  const senderId = str(sender.id) ?? str(obj(body.conversation).participantId);
  if (!text) return { kind: "ignore", reason: "no text" };
  if (!conversationId || !messageId || !senderId) return { kind: "ignore", reason: "incomplete message" };
  return {
    kind: "message",
    businessId: businessIdOf(body),
    accountId,
    platform,
    conversationId,
    messageId,
    text: text.slice(0, MAX_TEXT_LENGTH),
    senderId,
    senderName: str(sender.name) ?? str(obj(body.conversation).participantName),
    senderUsername: str(sender.username) ?? str(obj(body.conversation).participantUsername),
  };
}
