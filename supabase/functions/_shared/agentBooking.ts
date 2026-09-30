import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Server-side booking repository for the agent API.
//
// Ports the availability logic from src/lib/availabilityService.ts so the
// agent path and the human booking form share one source of truth. Runs with
// the service-role client, explicitly scoped by businessId on every query.
// ---------------------------------------------------------------------------

const SLOT_INTERVAL_MINUTES = 30;

interface ServiceBuffers {
  buffer_before: number;
  buffer_after: number;
}

interface WorkingHourRow {
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface TimeBlockRow {
  start_time: string;
  end_time: string;
}

interface ExistingBookingRow {
  start_time: string;
  duration: { duration_minutes: number } | null;
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

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();

  const { data: service } = await supabase
    .from("services")
    .select("buffer_before, buffer_after")
    .eq("id", serviceId)
    .eq("business_id", businessId)
    .maybeSingle();
  const buffers: ServiceBuffers = {
    buffer_before: service?.buffer_before ?? 0,
    buffer_after: service?.buffer_after ?? 0,
  };
  const totalDuration = durationMinutes + buffers.buffer_before + buffers.buffer_after;

  const { data: workingHours } = await supabase
    .from("working_hours")
    .select("start_time, end_time, is_available")
    .eq("specialist_id", specialistId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle() as { data: WorkingHourRow | null };

  if (!workingHours || !workingHours.is_available) return [];

  const { data: timeBlocks } = await supabase
    .from("time_blocks")
    .select("start_time, end_time")
    .eq("specialist_id", specialistId)
    .lte("start_time", `${date}T23:59:59`)
    .gte("end_time", `${date}T00:00:00`) as { data: TimeBlockRow[] | null };

  const { data: existingBookings } = await supabase
    .from("bookings")
    .select("start_time, duration:service_durations(duration_minutes)")
    .eq("specialist_id", specialistId)
    .eq("booking_date", date)
    .neq("status", "cancelled") as { data: ExistingBookingRow[] | null };

  // Exclude slots already held (not yet booked) so two agents don't grab the
  // same slot. Stale holds are expired first.
  await supabase.rpc("expire_stale_slot_holds");
  const { data: activeHolds } = await supabase
    .from("slot_holds")
    .select("start_time")
    .eq("specialist_id", specialistId)
    .eq("booking_date", date)
    .eq("status", "held");

  const heldTimes = new Set((activeHolds ?? []).map((h) => h.start_time));

  const allSlots = generateTimeSlots(
    workingHours.start_time,
    workingHours.end_time,
    SLOT_INTERVAL_MINUTES,
  );

  const blocks = timeBlocks ?? [];
  const bookings = existingBookings ?? [];

  return allSlots
    .map((time) => {
      const slotStart = parseTimeMs(time);
      const slotEnd = slotStart + totalDuration * 60_000;
      const startsAt = `${date}T${time}:00`;
      return { time, startsAt, slotStart, slotEnd };
    })
    .filter((slot) => {
      if (heldTimes.has(slot.time)) return false;
      if (isBlockedByTimeBlock(slot.slotStart, slot.slotEnd, date, blocks)) {
        return false;
      }
      if (
        isBlockedByBooking(
          slot.slotStart,
          slot.slotEnd,
          bookings,
          buffers.buffer_before,
          buffers.buffer_after,
        )
      ) {
        return false;
      }
      return true;
    })
    .map(({ time, startsAt }) => ({ time, startsAt }));
}

function generateTimeSlots(start: string, end: string, interval: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  for (let m = sh * 60 + sm; m < eh * 60 + em; m += interval) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
  }
  return slots;
}

function parseTimeMs(t: string): number {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function isBlockedByTimeBlock(
  slotStart: number,
  slotEnd: number,
  date: string,
  blocks: TimeBlockRow[],
): boolean {
  return blocks.some((b) => {
    const blockStart = new Date(b.start_time).getTime();
    const blockEnd = new Date(b.end_time).getTime();
    const dayStart = new Date(`${date}T00:00:00`);
    const s = dayStart.getTime() + (slotStart - parseTimeMs("00:00"));
    const e = dayStart.getTime() + (slotEnd - parseTimeMs("00:00"));
    return (
      (s >= blockStart && s < blockEnd) ||
      (e > blockStart && e <= blockEnd) ||
      (s <= blockStart && e >= blockEnd)
    );
  });
}

function isBlockedByBooking(
  slotStart: number,
  slotEnd: number,
  bookings: ExistingBookingRow[],
  bufferBefore: number,
  bufferAfter: number,
): boolean {
  return bookings.some((b) => {
    const bStart = parseTimeMs(b.start_time);
    const dur = b.duration?.duration_minutes ?? 60;
    const bEnd = bStart + (dur + bufferBefore + bufferAfter) * 60_000;
    return (
      (slotStart >= bStart && slotStart < bEnd) ||
      (slotEnd > bStart && slotEnd <= bEnd) ||
      (slotStart <= bStart && slotEnd >= bEnd)
    );
  });
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