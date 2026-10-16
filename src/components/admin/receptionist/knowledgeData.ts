import { supabase } from '../../../lib/supabase';

// Everything the receptionist knows, read from the app's own tables — the
// same sources the server-side prompt uses.

export interface KnowledgeData {
  treatments: { name: string; options: { minutes: number; priceCents: number }[] }[];
  therapists: { name: string; serviceCount: number }[];
  hours: { day: number; range: string | null }[]; // day 0 = Sunday, Monday first in the list
  valueAmountsCents: number[];
  sets: { name: string; priceCents: number }[];
  passes: { name: string; visits: number; priceCents: number }[];
  promotion: { title: string; text: string | null; until: string | null } | null;
  isAutoConfirm: boolean;
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

interface WorkingHour { day_of_week: number; start_time: string; end_time: string; is_available: boolean }

/** Earliest start to latest end of anyone working that weekday (same rule as the server). */
export function openingRanges(hours: WorkingHour[]): { day: number; range: string | null }[] {
  return MONDAY_FIRST.map((day) => {
    const open = hours.filter((h) => h.day_of_week === day && h.is_available && h.end_time > h.start_time);
    if (open.length === 0) return { day, range: null };
    const start = open.map((h) => h.start_time.slice(0, 5)).sort()[0];
    const ends = open.map((h) => h.end_time.slice(0, 5)).sort();
    const end = ends[ends.length - 1];
    return { day, range: `${start}–${end}` };
  });
}

function activePromotion(row: Record<string, unknown> | null): KnowledgeData['promotion'] {
  if (!row?.promo_title && !row?.promo_text) return null;
  const now = Date.now();
  const from = row.promo_valid_from ? Date.parse(String(row.promo_valid_from)) : null;
  const until = row.promo_valid_until ? Date.parse(String(row.promo_valid_until)) : null;
  if ((from && now < from) || (until && now > until)) return null;
  return { title: String(row.promo_title ?? ''), text: row.promo_text ? String(row.promo_text) : null, until: row.promo_valid_until ? String(row.promo_valid_until) : null };
}

export async function loadKnowledge(businessId: string): Promise<KnowledgeData> {
  const [services, staff, gift, sets, passes, business] = await Promise.all([
    supabase.from('services').select('name, service_durations(duration_minutes, price_cents)').eq('business_id', businessId).order('display_order'),
    supabase.from('specialists').select('name, specialist_services(service_id), working_hours(day_of_week, start_time, end_time, is_available)').eq('business_id', businessId).eq('is_active', true).order('name'),
    supabase.from('gift_card_settings').select('*').eq('business_id', businessId).maybeSingle(),
    supabase.from('gift_card_packages').select('name, price_cents').eq('business_id', businessId).eq('is_active', true).order('display_order'),
    supabase.from('service_pass_offers').select('name, visit_count, price_cents').eq('business_id', businessId).eq('is_active', true).order('created_at'),
    supabase.from('businesses').select('agent_consent_policy').eq('id', businessId).single(),
  ]);
  const firstError = services.error ?? staff.error ?? sets.error ?? passes.error;
  if (firstError) throw firstError;
  type StaffRow = { name: string; specialist_services: { service_id: string }[]; working_hours: WorkingHour[] };
  const staffRows = (staff.data ?? []) as StaffRow[];
  return {
    treatments: ((services.data ?? []) as { name: string; service_durations: { duration_minutes: number; price_cents: number }[] }[])
      .map((s) => ({
        name: s.name,
        options: (s.service_durations ?? []).slice().sort((a, b) => a.duration_minutes - b.duration_minutes)
          .map((d) => ({ minutes: d.duration_minutes, priceCents: d.price_cents })),
      })),
    therapists: staffRows.map((s) => ({ name: s.name, serviceCount: (s.specialist_services ?? []).length })),
    hours: openingRanges(staffRows.flatMap((s) => s.working_hours ?? [])),
    valueAmountsCents: gift.data?.enabled === false ? [] : ((gift.data?.preset_amounts_cents as number[] | null) ?? []),
    sets: ((sets.data ?? []) as { name: string; price_cents: number }[]).map((p) => ({ name: p.name, priceCents: p.price_cents })),
    passes: ((passes.data ?? []) as { name: string; visit_count: number; price_cents: number }[]).map((p) => ({ name: p.name, visits: p.visit_count, priceCents: p.price_cents })),
    promotion: activePromotion(gift.data as Record<string, unknown> | null),
    isAutoConfirm: business.data?.agent_consent_policy !== 'manual',
  };
}
