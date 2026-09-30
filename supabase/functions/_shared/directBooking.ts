import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getAvailableSlots } from "./agentBooking.ts";
import {
  BUSINESS_TIMEZONE,
  RATE_WINDOW_MINUTES,
  earliestStart,
  mergeSlots,
  type SpecialistSlot,
} from "./directBookingLogic.ts";

// Data access for keyless AI bookings (agent-direct). Reuses the booking
// engine in agentBooking.ts so AI and human bookings share one availability
// source of truth.

export const DIRECT_BOOK_ACTION = "direct_book";

export class DirectBookingError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DirectBookingError";
  }
}

export interface DirectBusiness {
  id: string;
  name: string;
  address_line: string | null;
  city: string | null;
  agent_consent_policy: "auto" | "manual";
  agent_lead_time_minutes: number;
  agent_slot_hold_seconds: number;
}

export interface DirectDuration {
  id: string;
  duration_minutes: number;
  price_cents: number;
  service: { id: string; name: string };
}

export async function loadBookableBusiness(supabase: SupabaseClient, permalink: string): Promise<DirectBusiness> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, address_line, city, agent_enabled, agent_consent_policy, agent_lead_time_minutes, agent_slot_hold_seconds")
    .eq("permalink", permalink)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`business lookup failed: ${error.message}`);
  if (!data) throw new DirectBookingError("Business not found", 404);
  if (!data.agent_enabled) throw new DirectBookingError("This business does not accept AI bookings yet. Book on its website instead.", 403);
  return data as DirectBusiness;
}

export async function loadDuration(supabase: SupabaseClient, businessId: string, durationId: string): Promise<DirectDuration> {
  const { data, error } = await supabase
    .from("service_durations")
    .select("id, duration_minutes, price_cents, services!inner(id, name, business_id)")
    .eq("id", durationId)
    .eq("services.business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(`duration lookup failed: ${error.message}`);
  if (!data) throw new DirectBookingError("Unknown service for this business", 404);
  const service = data.services as unknown as { id: string; name: string };
  return { id: data.id, duration_minutes: data.duration_minutes, price_cents: data.price_cents, service };
}

/** Active staff who offer the service; all active staff when no mapping exists. */
async function staffFor(supabase: SupabaseClient, businessId: string, serviceId: string): Promise<string[]> {
  const { data: active, error } = await supabase
    .from("specialists")
    .select("id")
    .eq("business_id", businessId)
    .eq("is_active", true);
  if (error) throw new Error(`staff lookup failed: ${error.message}`);
  const activeIds = (active ?? []).map((s) => s.id as string);

  const { data: mapped } = await supabase.from("specialist_services").select("specialist_id").eq("service_id", serviceId);
  const offering = new Set((mapped ?? []).map((m) => m.specialist_id as string));
  return offering.size ? activeIds.filter((id) => offering.has(id)) : activeIds;
}

export async function freeSlots(
  supabase: SupabaseClient,
  business: DirectBusiness,
  duration: DirectDuration,
  date: string,
): Promise<SpecialistSlot[]> {
  const staff = await staffFor(supabase, business.id, duration.service.id);
  const perStaff = await Promise.all(
    staff.map(async (specialistId) => {
      const slots = await getAvailableSlots(supabase, {
        businessId: business.id,
        serviceId: duration.service.id,
        durationMinutes: duration.duration_minutes,
        specialistId,
        date,
      });
      return slots.map((s) => ({ ...s, specialistId }));
    }),
  );
  const earliest = earliestStart(new Date(), business.agent_lead_time_minutes, BUSINESS_TIMEZONE);
  return mergeSlots(perStaff.flat(), earliest);
}

export async function recentAttempts(
  supabase: SupabaseClient,
  businessId: string,
  client: string,
): Promise<{ business: number; client: number }> {
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();
  const base = () =>
    supabase.from("agent_events").select("id", { count: "exact", head: true }).eq("action", DIRECT_BOOK_ACTION).gte("created_at", since);
  const [byBusiness, byClient] = await Promise.all([
    base().eq("business_id", businessId).eq("result", "confirmed"),
    base().eq("payload->>client", client),
  ]);
  if (byBusiness.error || byClient.error) throw new Error("rate limit lookup failed");
  return { business: byBusiness.count ?? 0, client: byClient.count ?? 0 };
}

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} €`;

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Same confirmation email the human booking form sends (template booking_confirmation). */
export async function sendCustomerConfirmation(
  supabase: SupabaseClient,
  args: { business: DirectBusiness; duration: DirectDuration; bookingId: string; date: string; time: string; name: string; email: string; specialistName: string; cancelUrl: string },
): Promise<void> {
  const { error } = await supabase.functions.invoke("send-business-email", {
    body: {
      business_id: args.business.id,
      event_key: "booking_confirmation",
      recipient_email: args.email,
      recipient_name: args.name,
      booking_id: args.bookingId,
      variables: {
        customer_name: args.name,
        customer_email: args.email,
        service_name: args.duration.service.name,
        service_duration: `${args.duration.duration_minutes} minutes`,
        service_price: formatPrice(args.duration.price_cents),
        booking_date: args.date,
        booking_time: args.time,
        booking_end_time: addMinutes(args.time, args.duration.duration_minutes),
        specialist_name: args.specialistName,
        business_name: args.business.name,
        business_address: [args.business.address_line, args.business.city].filter(Boolean).join(", "),
        business_phone: "",
        business_email: "",
        cancellation_link: args.cancelUrl,
        reschedule_link: args.cancelUrl,
      },
    },
  });
  if (error) console.error("agent-direct: customer confirmation email failed", error);
}
