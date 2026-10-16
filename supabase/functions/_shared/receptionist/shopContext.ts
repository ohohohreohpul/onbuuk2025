// Everything the receptionist may tell a customer, loaded live from the shop's
// own data. The model only ever sees short references (d1, t1 …) so it cannot
// book an id that does not belong to this shop.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { loadMarketingShop, loadShopVouchers } from "../marketingData.ts";
import type { MarketingVoucher } from "../marketingEmail.ts";
import type { Playbook } from "./playbook.ts";

export type ShopLanguage = "de" | "en" | "th";

export interface ReceptionistSettings {
  business_id: string;
  is_enabled: boolean;
  assistant_name: string;
  instructions: string;
  knowledge: string;
  address_form: "sie" | "du";
  faq: { question: string; answer: string }[];
  playbook: Playbook;
  web_enabled: boolean;
  web_mode: "auto" | "drafts";
  widget_key: string;
  widget_greeting: string;
  widget_color: string | null;
  email_enabled: boolean;
  email_mode: "auto" | "drafts";
  imap_host: string | null;
  imap_port: number;
  imap_username: string | null;
  imap_uidvalidity: number | null;
  imap_last_uid: number;
  whatsapp_enabled: boolean;
  whatsapp_mode: "auto" | "drafts";
  whatsapp_provider: "cloud_api" | "qr_gateway" | null;
  whatsapp_status: string;
  whatsapp_phone_number_id: string | null;
  whatsapp_display_phone: string | null;
  whatsapp_instance: string | null;
  whatsapp_warmup_started_at: string | null;
  whatsapp_bulk_date: string | null;
  whatsapp_bulk_sent: number;
  whatsapp_last_bulk_at: string | null;
}

export interface CatalogEntry {
  ref: string; // "d1"
  durationId: string;
  serviceId: string;
  serviceName: string;
  description: string | null;
  minutes: number;
  priceCents: number;
  isPair: boolean;
}

export interface StaffEntry {
  ref: string; // "t1"
  id: string;
  name: string;
  serviceIds: string[]; // empty = offers everything
}

export interface ShopContext {
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  language: ShopLanguage;
  shopUrl: string | null;
  consentPolicy: "auto" | "manual";
  leadTimeMinutes: number;
  holdSeconds: number;
  catalog: CatalogEntry[];
  staff: StaffEntry[];
  vouchers: MarketingVoucher[];
  giftCards: { enabled: boolean; presetCents: number[]; customMinCents: number | null; customMaxCents: number | null; payInStore: boolean };
  promotion: { title: string; text: string; giftNote: string | null } | null;
  /** "Mon 10:00–20:00" … from the therapists' working hours (earliest start to latest end per weekday). */
  openingHours: string[];
  /** Booking-page switch "Customers choose their therapist" (site_settings allowSpecialistChoice). */
  allowStaffChoice: boolean;
  settings: ReceptionistSettings;
}

const DEFAULT_HOLD_SECONDS = 300;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export interface WorkingHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

/** Shop opening hours per weekday = earliest start to latest end of anyone working that day. */
export function openingHours(hours: WorkingHour[]): string[] {
  return MONDAY_FIRST.map((day) => {
    const open = hours.filter((h) => h.day_of_week === day && h.is_available && h.end_time > h.start_time);
    if (open.length === 0) return `${WEEKDAYS[day]} closed`;
    const start = open.map((h) => h.start_time.slice(0, 5)).sort()[0];
    const end = open.map((h) => h.end_time.slice(0, 5)).sort().at(-1);
    return `${WEEKDAYS[day]} ${start}–${end}`;
  });
}

export async function loadSettings(supabase: SupabaseClient, businessId: string): Promise<ReceptionistSettings | null> {
  const { data, error } = await supabase.from("receptionist_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (error) throw new Error(`settings lookup failed: ${error.message}`);
  return data as ReceptionistSettings | null;
}

function activePromotion(row: Record<string, unknown> | null): ShopContext["promotion"] {
  if (!row?.promo_title && !row?.promo_text) return null;
  const now = Date.now();
  const from = row.promo_valid_from ? Date.parse(String(row.promo_valid_from)) : null;
  const until = row.promo_valid_until ? Date.parse(String(row.promo_valid_until)) : null;
  if ((from && now < from) || (until && now > until)) return null;
  return {
    title: String(row.promo_title ?? ""),
    text: String(row.promo_text ?? ""),
    giftNote: row.promo_gift_note ? String(row.promo_gift_note) : null,
  };
}

export async function loadShopContext(supabase: SupabaseClient, settings: ReceptionistSettings): Promise<ShopContext> {
  const businessId = settings.business_id;
  const [businessRes, servicesRes, staffRes, giftRes, shop] = await Promise.all([
    supabase.from("businesses").select("name, address, phone, agent_consent_policy, agent_lead_time_minutes, agent_slot_hold_seconds")
      .eq("id", businessId).single(),
    supabase.from("services").select("id, name, description, is_pair_massage, service_durations(id, duration_minutes, price_cents)")
      .eq("business_id", businessId).order("display_order"),
    supabase.from("specialists").select("id, name, specialist_services(service_id), working_hours(day_of_week, start_time, end_time, is_available)").eq("business_id", businessId).eq("is_active", true).order("name"),
    supabase.from("gift_card_settings").select("*").eq("business_id", businessId).maybeSingle(),
    loadMarketingShop(supabase, businessId),
  ]);
  const { data: choiceRow } = await supabase.from("site_settings").select("value")
    .eq("business_id", businessId).eq("key", "allowSpecialistChoice").maybeSingle();
  const choiceValue = typeof choiceRow?.value === "string" ? choiceRow.value : JSON.stringify(choiceRow?.value ?? "");
  if (businessRes.error || !businessRes.data) throw new Error(`business lookup failed: ${businessRes.error?.message}`);
  if (servicesRes.error) throw new Error(`services lookup failed: ${servicesRes.error.message}`);
  if (staffRes.error) throw new Error(`staff lookup failed: ${staffRes.error.message}`);

  const catalog: CatalogEntry[] = [];
  for (const service of (servicesRes.data ?? []) as Record<string, unknown>[]) {
    const durations = ((service.service_durations ?? []) as { id: string; duration_minutes: number; price_cents: number }[])
      .slice().sort((a, b) => a.duration_minutes - b.duration_minutes);
    for (const d of durations) {
      catalog.push({
        ref: `d${catalog.length + 1}`,
        durationId: d.id,
        serviceId: String(service.id),
        serviceName: String(service.name),
        description: service.description ? String(service.description).slice(0, 240) : null,
        minutes: d.duration_minutes,
        priceCents: d.price_cents,
        isPair: Boolean(service.is_pair_massage),
      });
    }
  }

  type StaffRow = { id: string; name: string; specialist_services: { service_id: string }[]; working_hours: WorkingHour[] };
  const staffRows = (staffRes.data ?? []) as StaffRow[];
  const staff: StaffEntry[] = staffRows
    .map((s, i) => ({ ref: `t${i + 1}`, id: s.id, name: s.name, serviceIds: (s.specialist_services ?? []).map((x) => x.service_id) }));

  const gift = giftRes.data as Record<string, unknown> | null;
  const business = businessRes.data;
  return {
    businessId,
    name: shop.name,
    address: shop.address,
    phone: shop.phone,
    language: shop.language,
    shopUrl: shop.shopUrl,
    consentPolicy: business.agent_consent_policy === "manual" ? "manual" : "auto",
    leadTimeMinutes: Number(business.agent_lead_time_minutes ?? 60),
    holdSeconds: Number(business.agent_slot_hold_seconds ?? DEFAULT_HOLD_SECONDS),
    catalog,
    staff,
    vouchers: await loadShopVouchers(supabase, businessId, shop).catch(() => []),
    giftCards: {
      enabled: gift?.enabled !== false && Boolean(gift),
      presetCents: Array.isArray(gift?.preset_amounts_cents) ? (gift!.preset_amounts_cents as number[]) : [],
      customMinCents: gift?.allow_custom_amount ? Number(gift.min_custom_amount_cents ?? 0) : null,
      customMaxCents: gift?.allow_custom_amount ? Number(gift.max_custom_amount_cents ?? 0) : null,
      payInStore: gift?.pay_in_store_enabled === true,
    },
    promotion: activePromotion(gift),
    openingHours: openingHours(staffRows.flatMap((s) => s.working_hours ?? [])),
    allowStaffChoice: choiceValue.replace(/"/g, "").trim().toLowerCase() !== "false",
    settings,
  };
}
