/**
 * "Own Zernio": a shop (later an agency's clients) can use its own Zernio account
 * instead of Zenno's, so the Zernio bill is theirs. The key and webhook secret live
 * in Supabase Vault (private.zernio_connections); events from that account arrive at
 * social-webhook?c=<connection id> and are checked against that connection.
 * Pure helpers, so they run in Deno and in the vitest suite.
 */

export class ConnectionInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_KEY = /^[A-Za-z0-9_.-]{20,300}$/;

/** Events Zenno acts on (DMs, account changes, Google reviews). */
export const ZENNO_WEBHOOK_EVENTS = [
  "message.received", "account.connected", "account.disconnected", "review.new", "review.updated", "review.restored",
];

export function readZernioApiKey(value: unknown): string {
  const key = typeof value === "string" ? value.trim() : "";
  if (!API_KEY.test(key)) throw new ConnectionInputError("Please paste the API key from your Zernio dashboard (Settings → API keys).");
  return key;
}

export type WebhookRoute = { kind: "platform" } | { kind: "own"; connectionId: string } | { kind: "invalid" };

export function webhookRoute(url: URL): WebhookRoute {
  const id = url.searchParams.get("c");
  if (id === null) return { kind: "platform" };
  return UUID.test(id) ? { kind: "own", connectionId: id.toLowerCase() } : { kind: "invalid" };
}

/**
 * An event may only touch a shop that belongs to the account it came from: Zenno's
 * own Zernio serves shops without a connection, an own Zernio only its shop.
 */
export function isEventForRoute(route: WebhookRoute, shopConnectionId: string | null): boolean {
  if (route.kind === "platform") return shopConnectionId === null;
  if (route.kind === "own") return shopConnectionId?.toLowerCase() === route.connectionId;
  return false;
}

export const ownWebhookUrl = (supabaseUrl: string, connectionId: string): string =>
  `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/social-webhook?c=${connectionId}`;

/** POST /v1/webhooks/settings body for the shop's own Zernio account. */
export const buildWebhookSettings = (url: string, secret: string) =>
  ({ name: "Zenno", url, secret, events: ZENNO_WEBHOOK_EVENTS, isActive: true });
