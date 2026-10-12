import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Server-side booking repository for the agent API.
//
// Availability comes from the SQL function public.get_available_slots, the same
// engine the booking page uses (working hours, buffers, bookings, time off, shop
// closures, couple bookings). Runs with the service-role client, explicitly
// scoped by businessId on every query.
// ---------------------------------------------------------------------------

interface SlotRow {
  slot_date: string;
  slot_time: string; // "HH:MM:SS"
  free_specialists: number;
}

export interface AvailableSlot {
  time: string; // "HH:MM"
  /** ISO datetime combining date + time, business-local. */
  startsAt: string;
}

// --- availability ----------------------------------------------------------

export async function getAvailableSlots(
  supabase: SupabaseClient,
  args: {
    businessId: string;
    serviceId: string;
    durationMinutes: number;
    specialistId: string;
    date: string; // YYYY-MM-DD
  },
): Promise<AvailableSlot[]> {
  const { businessId, serviceId, durationMinutes, specialistId, date } = args;

  const { data: duration, error: durationError } = await supabase
    .from("service_durations")
    .select("id")
    .eq("service_id", serviceId)
    .eq("business_id", businessId)
    .eq("duration_minutes", durationMinutes)
    .limit(1)
    .maybeSingle();
  if (durationError) throw new Error(`Could not load treatment length: ${durationError.message}`);
  if (!duration) return [];

  const { data: rows, error: slotsError } = await supabase.rpc("get_available_slots", {
    p_business_id: businessId,
    p_duration_id: duration.id,
    p_specialist_id: specialistId,
    p_from: date,
    p_days: 1,
  });
  if (slotsError) throw new Error(`Could not load availability: ${slotsError.message}`);

  // Exclude slots already held (not yet booked) so two agents don't grab the
  // same slot. Stale holds are expired first.
  await supabase.rpc("expire_stale_slot_holds");
  const { data: activeHolds } = await supabase
    .from("slot_holds")
    .select("start_time")
    .eq("specialist_id", specialistId)
    .eq("booking_date", date)
    .eq("status", "held");
  const heldTimes = new Set((activeHolds ?? []).map((h) => String(h.start_time).slice(0, 5)));

  return ((rows ?? []) as SlotRow[])
    .filter((row) => row.slot_date === date)
    .map((row) => row.slot_time.slice(0, 5))
    .filter((time) => !heldTimes.has(time))
    .map((time) => ({ time, startsAt: `${date}T${time}:00` }));
}

// --- holds -----------------------------------------------------------------

export interface HoldRecord {
  id: string;
  held_until: string;
}

export async function createHold(
  supabase: SupabaseClient,
  args: {
    businessId: string;
    serviceId: string;
    durationId: string;
    specialistId: string;
    date: string;
    startTime: string; // "HH:MM"
    holdSeconds: number;
    /** null for keyless AI bookings (agent-direct). */
    agentKeyId: string | null;
    customerEmail: string;
    customerName?: string;
    customerPhone?: string;
  },
): Promise<HoldRecord> {
  // Idempotent: an existing active hold for the same slot + email is reused.
  await supabase.rpc("expire_stale_slot_holds");
  const { data: existing } = await supabase
    .from("slot_holds")
    .select("id, held_until")
    .eq("business_id", args.businessId)
    .eq("specialist_id", args.specialistId)
    .eq("booking_date", args.date)
    .eq("start_time", args.startTime)
    .eq("customer_email", args.customerEmail)
    .eq("status", "held")
    .maybeSingle();

  if (existing) return existing as HoldRecord;

  const heldUntil = new Date(Date.now() + args.holdSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("slot_holds")
    .insert({
      business_id: args.businessId,
      service_id: args.serviceId,
      duration_id: args.durationId,
      specialist_id: args.specialistId,
      booking_date: args.date,
      start_time: args.startTime,
      held_until: heldUntil,
      agent_key_id: args.agentKeyId,
      customer_email: args.customerEmail,
      customer_name: args.customerName ?? null,
      customer_phone: args.customerPhone ?? null,
      status: "held",
    })
    .select("id, held_until")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create hold: ${error?.message ?? "unknown"}`);
  }
  return data as HoldRecord;
}

// --- bookings --------------------------------------------------------------

export interface BookingRecord {
  id: string;
  status: string;
  booking_date: string;
  start_time: string;
}

export async function createBookingFromHold(
  supabase: SupabaseClient,
  args: {
    businessId: string;
    holdId: string;
    consentPolicy: "auto" | "manual";
    notes?: string;
    /** Assistant name shown to the merchant, e.g. "ChatGPT". */
    aiAgent?: string;
  },
): Promise<BookingRecord> {
  const { data: hold, error: holdError } = await supabase
    .from("slot_holds")
    .select("*")
    .eq("id", args.holdId)
    .eq("business_id", args.businessId)
    .maybeSingle();

  if (holdError || !hold) {
    throw new Error("Hold not found");
  }
  if (hold.status !== "held") {
    throw new Error(`Hold is ${hold.status}, not held`);
  }
  if (new Date(hold.held_until).getTime() < Date.now()) {
    throw new Error("Hold has expired");
  }

  const status = args.consentPolicy === "auto" ? "confirmed" : "pending";

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      business_id: args.businessId,
      service_id: hold.service_id,
      duration_id: hold.duration_id,
      specialist_id: hold.specialist_id,
      booking_date: hold.booking_date,
      start_time: hold.start_time,
      customer_name: hold.customer_name ?? "Agent booking",
      customer_email: hold.customer_email,
      customer_phone: hold.customer_phone ?? "",
      is_pair_booking: false,
      payment_status: "pending",
      status,
      notes: args.notes ?? "Created by AI agent",
      channel: "ai_booked",
      ai_agent: args.aiAgent ?? null,
    })
    .select("id, status, booking_date, start_time")
    .single();

  if (error || !booking) {
    throw new Error(`Failed to create booking: ${error?.message ?? "unknown"}`);
  }

  await supabase
    .from("slot_holds")
    .update({ status: "booked" })
    .eq("id", hold.id);

  return booking as BookingRecord;
}

export async function cancelBooking(
  supabase: SupabaseClient,
  args: { businessId: string; bookingId: string; customerEmail: string },
): Promise<BookingRecord> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, status, customer_email, booking_date, start_time")
    .eq("id", args.bookingId)
    .eq("business_id", args.businessId)
    .maybeSingle();

  if (error || !booking) {
    throw new Error("Booking not found");
  }
  if ((booking.customer_email ?? "").toLowerCase() !== args.customerEmail.toLowerCase()) {
    throw new Error("Customer email does not match booking");
  }
  if (booking.status === "cancelled") {
    return booking as BookingRecord;
  }

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .select("id, status, booking_date, start_time")
    .single();

  if (updateError || !updated) {
    throw new Error("Failed to cancel booking");
  }
  return updated as BookingRecord;
}

// --- audit -----------------------------------------------------------------

export async function logAgentEvent(
  supabase: SupabaseClient,
  args: {
    businessId: string;
    /** null for keyless AI bookings (agent-direct). */
    agentKeyId: string | null;
    action: string;
    payload: unknown;
    result: string;
    confidence?: number;
  },
): Promise<void> {
  await supabase.from("agent_events").insert({
    business_id: args.businessId,
    agent_key_id: args.agentKeyId,
    action: args.action,
    payload: args.payload as never,
    result: args.result,
    confidence: args.confidence ?? null,
  });
}

export async function recordAgentBooking(
  supabase: SupabaseClient,
  args: {
    businessId: string;
    bookingId: string;
    /** null for keyless AI bookings (agent-direct). */
    agentKeyId: string | null;
    agentName: string;
    confidence: number;
    source: string;
  },
): Promise<{ approvalToken: string | null }> {
  const { data, error } = await supabase
    .from("agent_bookings")
    .insert({
      business_id: args.businessId,
      booking_id: args.bookingId,
      agent_key_id: args.agentKeyId,
      agent_name: args.agentName,
      confidence: args.confidence,
      source: args.source,
    })
    .select("approval_token")
    .single();
  if (error) {
    console.error("recordAgentBooking failed", error);
    return { approvalToken: null };
  }
  return { approvalToken: (data?.approval_token as string | undefined) ?? null };
}