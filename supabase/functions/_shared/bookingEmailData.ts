/**
 * Everything a booking email needs, loaded from the booking itself (never from
 * the caller). Values are HTML-escaped so a customer's name can't inject markup.
 * Used by send-business-email (booking page) and process-notifications (queue).
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_APP_URL = "https://app.onbuuk.com";

export type EmailLanguage = "de" | "en";

export interface BookingEmailData {
  bookingId: string;
  businessId: string;
  status: string;
  createdAt: string;
  bookingDate: string;
  startTime: string; // "HH:MM"
  customerEmail: string;
  customerName: string;
  language: EmailLanguage;
  /** HTML-escaped template variables ({{customer_name}}, {{booking_date}}, ...). */
  variables: Record<string, string>;
}

/** Resolves the link base (scheme + host [+ path]) for cancel / rebook links. */
export type LinkBaseResolver = (businessId: string, permalink: string | null) => Promise<string>;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** PostgREST types embedded rows as arrays even for many-to-one joins. */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function shopCurrency(supabase: SupabaseClient, businessId: string): Promise<string> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("business_id", businessId)
    .eq("key", "currency")
    .maybeSingle();
  const raw = data?.value;
  if (!raw) return "EUR";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : String(raw);
  } catch {
    return String(raw);
  }
}

/**
 * Links in queued emails: the shop's verified primary custom domain, otherwise
 * the app with the shop's path (app.onbuuk.com/<permalink>/cancel works).
 */
export async function defaultLinkBase(supabase: SupabaseClient, businessId: string, permalink: string | null): Promise<string> {
  const { data: domains } = await supabase
    .from("custom_domains")
    .select("domain, is_primary")
    .eq("business_id", businessId)
    .eq("status", "verified")
    .order("is_primary", { ascending: false })
    .limit(1);
  const domain = (domains ?? [])[0]?.domain as string | undefined;
  if (domain) return `https://${domain}`;
  const app = (Deno.env.get("APP_PUBLIC_URL") ?? DEFAULT_APP_URL).replace(/\/$/, "");
  return permalink ? `${app}/${permalink}` : app;
}

export async function loadBookingEmailData(
  supabase: SupabaseClient,
  bookingId: string,
  resolveLinkBase: LinkBaseResolver = (businessId, permalink) => defaultLinkBase(supabase, businessId, permalink),
): Promise<BookingEmailData | null> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(`id, business_id, status, created_at, booking_date, start_time, customer_name, customer_email,
      customer_phone, notes, is_pair_booking,
      specialist:specialists!bookings_specialist_id_fkey(name), service:services(name),
      duration:service_durations(duration_minutes, price_cents)`)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(`Could not load booking ${bookingId}: ${error.message}`);
  if (!booking) return null;

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("name, address, phone, language, permalink")
    .eq("id", booking.business_id)
    .maybeSingle();
  if (businessError) throw new Error(`Could not load business: ${businessError.message}`);

  const language: EmailLanguage = business?.language === "de" ? "de" : "en";
  const locale = language === "de" ? "de-DE" : "en-US";
  const service = one<{ name: string }>(booking.service);
  const specialist = one<{ name: string }>(booking.specialist);
  const duration = one<{ duration_minutes: number; price_cents: number }>(booking.duration);
  const durationMinutes = duration?.duration_minutes ?? 60;
  const base = await resolveLinkBase(booking.business_id, business?.permalink ?? null);
  const currency = await shopCurrency(supabase, booking.business_id);
  const startTime = String(booking.start_time).slice(0, 5);
  const date = new Date(`${booking.booking_date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
  const price = new Intl.NumberFormat(locale, { style: "currency", currency })
    .format((duration?.price_cents ?? 0) / 100);
  const cancelLink = `${base}/cancel?id=${booking.id}`;
  const adminBase = (Deno.env.get("APP_PUBLIC_URL") ?? DEFAULT_APP_URL).replace(/\/$/, "");

  const values: Record<string, string> = {
    customer_name: booking.customer_name ?? "",
    customer_email: booking.customer_email ?? "",
    customer_phone: booking.customer_phone ?? "",
    customer_notes: booking.notes ?? "",
    service_name: service?.name ?? "",
    service_duration: `${durationMinutes} ${language === "de" ? "Minuten" : "minutes"}`,
    service_price: price,
    booking_date: date,
    booking_time: startTime,
    booking_end_time: addMinutes(startTime, durationMinutes),
    booking_type: booking.is_pair_booking ? (language === "de" ? "Paarbehandlung" : "Couple") : "",
    specialist_name: specialist?.name ?? "",
    business_name: business?.name ?? "",
    business_address: business?.address ?? "",
    business_phone: business?.phone ?? "",
    business_email: "",
    cancellation_link: cancelLink,
    reschedule_link: cancelLink,
    cancellation_reason: "",
    cancelled_by: "customer",
    rebook_link: base,
    admin_link: `${adminBase}/admin`,
  };

  return {
    bookingId: booking.id,
    businessId: booking.business_id,
    status: booking.status,
    createdAt: booking.created_at,
    bookingDate: booking.booking_date,
    startTime,
    customerEmail: booking.customer_email ?? "",
    customerName: booking.customer_name ?? "",
    language,
    variables: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, escapeHtml(value)])),
  };
}
