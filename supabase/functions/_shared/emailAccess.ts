/**
 * Who may send which email through a business's mail provider.
 *
 *  - server   other edge functions (service-role key): sent as requested
 *  - admin    a signed-in, active admin of that business: sent as requested
 *  - public   the booking page / cancel page without sign-in: only
 *             booking_confirmation and booking_cancelled for a real booking.
 *             Recipient, text and links are rebuilt here from the booking,
 *             so nobody can use the shop's sender for their own content.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AuthorizationError, requireActiveAdmin } from "./adminAuthorization.ts";
import { escapeHtml, loadBookingEmailData } from "./bookingEmailData.ts";

export type EmailCaller = "server" | "admin" | "public";

export const PUBLIC_EVENT_KEYS = ["booking_confirmation", "booking_cancelled"] as const;
type PublicEventKey = typeof PUBLIC_EVENT_KEYS[number];

/** A confirmation may only be (re)sent shortly after the booking was made. */
const CONFIRMATION_WINDOW_MINUTES = 30;
const PLATFORM_HOSTS = ["book.zennohq.com", "book.zennohq.studio", "app.onbuuk.com", "onbuuk.com", "www.onbuuk.com"];
const SHOP_BASE_DOMAINS = ["zennohq.com", "zennohq.studio"];
const DEFAULT_APP_URL = "https://app.onbuuk.com";

function bearerToken(req: Request): string {
  const header = req.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

export function isServiceRoleRequest(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return serviceKey.length > 0 && bearerToken(req) === serviceKey;
}

/** server > admin of this business > public (anonymous or another business's admin). */
export async function identifyEmailCaller(req: Request, businessId: string): Promise<EmailCaller> {
  if (isServiceRoleRequest(req)) return "server";
  try {
    await requireActiveAdmin(req, { businessId });
    return "admin";
  } catch (error) {
    if (error instanceof AuthorizationError) return "public";
    throw error;
  }
}

export { escapeHtml };

/** Hosts a public request may name as the base for links in its email. */
export function isTrustedHost(host: string, permalink: string | null, customDomains: string[]): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (PLATFORM_HOSTS.includes(normalized)) return true;
  if (permalink && SHOP_BASE_DOMAINS.some((base) => normalized === `${permalink.toLowerCase()}.${base}`)) return true;
  return customDomains.some((domain) => domain.toLowerCase() === normalized);
}

async function linkBase(supabase: SupabaseClient, req: Request, businessId: string, permalink: string | null): Promise<string> {
  const fallback = (Deno.env.get("APP_PUBLIC_URL") ?? DEFAULT_APP_URL).replace(/\/$/, "");
  const origin = req.headers.get("Origin");
  if (!origin) return fallback;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return fallback;
  }

  const { data: domains } = await supabase
    .from("custom_domains")
    .select("domain")
    .eq("business_id", businessId)
    .eq("status", "verified");
  const customDomains = (domains ?? []).map((row: { domain: string }) => row.domain);
  return isTrustedHost(url.hostname, permalink, customDomains) ? url.origin : fallback;
}

export interface PublicEmail {
  recipientEmail: string;
  recipientName: string;
  variables: Record<string, string>;
}

/** Validates a public request and rebuilds everything that goes into the email. */
export async function buildPublicBookingEmail(
  supabase: SupabaseClient,
  req: Request,
  businessId: string,
  eventKey: string,
  bookingId: string | undefined,
): Promise<PublicEmail> {
  if (!(PUBLIC_EVENT_KEYS as readonly string[]).includes(eventKey) || !bookingId) {
    throw new AuthorizationError("Sign in is required to send this email", 401);
  }

  const data = await loadBookingEmailData(supabase, bookingId, (id, permalink) => linkBase(supabase, req, id, permalink));
  if (!data || data.businessId !== businessId) {
    throw new AuthorizationError("Booking not found", 404);
  }
  assertPublicEventAllowed(eventKey as PublicEventKey, data.status, data.createdAt);

  return { recipientEmail: data.customerEmail, recipientName: data.customerName, variables: data.variables };
}

export function assertPublicEventAllowed(eventKey: PublicEventKey, status: string, createdAt: string, now = Date.now()): void {
  if (eventKey === "booking_cancelled") {
    if (status !== "cancelled") throw new AuthorizationError("Booking is not cancelled", 409);
    return;
  }
  if (status === "cancelled") throw new AuthorizationError("Booking is cancelled", 409);
  const ageMinutes = (now - new Date(createdAt).getTime()) / 60000;
  if (ageMinutes > CONFIRMATION_WINDOW_MINUTES) {
    throw new AuthorizationError("Confirmation can only be sent right after booking", 409);
  }
}
