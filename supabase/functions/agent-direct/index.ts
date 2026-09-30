import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";
import { createHold, createBookingFromHold, logAgentEvent, recordAgentBooking } from "../_shared/agentBooking.ts";
import { notifyMerchantOfAgentBooking } from "../_shared/agentNotify.ts";
import { isTypesafeConfigured, routeIntent } from "../_shared/typesafe.ts";
import { validateAvailabilityInput, validateBookingInput, rateLimitReason, type DirectBookingInput } from "../_shared/directBookingLogic.ts";
import {
  DIRECT_BOOK_ACTION,
  DirectBookingError,
  freeSlots,
  loadBookableBusiness,
  loadDuration,
  recentAttempts,
  sendCustomerConfirmation,
} from "../_shared/directBooking.ts";

// POST /agent/v1/direct — keyless booking for AI assistants, behind the
// AI booking form on every shop host (/ai-booking, Vercel).
//   { action: "availability", permalink, durationId, date }
//   { action: "book", permalink, durationId, date, time, specialistId?, name, email, phone, confirm, customerRequest?, client?, origin?, agentName? }
// Same access as the public human booking form, plus: explicit confirm,
// Jev intent check, per-business and per-client caps, audit log, emails to
// merchant and customer.

type SupabaseClient = ReturnType<typeof publicServiceClient>;

const DEFAULT_APP_ORIGIN = "https://app.onbuuk.com";
const SAFE_ORIGIN = /^https:\/\/[a-z0-9.-]+$/i;
const MAX_AGENT_NAME = 60;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function availability(supabase: SupabaseClient, body: Record<string, unknown>) {
  const input = validateAvailabilityInput(body);
  if (!input.ok) return agentError(input.errors.join("; "), 400);
  const business = await loadBookableBusiness(supabase, input.value.permalink);
  const duration = await loadDuration(supabase, business.id, input.value.durationId);
  const slots = await freeSlots(supabase, business, duration, input.value.date);
  return agentJson({
    business: business.name,
    service: duration.service.name,
    minutes: duration.duration_minutes,
    date: input.value.date,
    slots: slots.map((s) => ({ time: s.time, specialistId: s.specialistId })),
  });
}

/** Jev check: a free-text request that is not a booking must not create one. */
async function intentBlocksBooking(customerRequest?: string): Promise<string | null> {
  if (!customerRequest || !isTypesafeConfigured()) return null;
  try {
    const { intent } = await routeIntent(customerRequest);
    return intent === "book" || intent === "hold" ? null : intent;
  } catch (err) {
    // confirm:true is already required, so a TypeSafe outage must not block bookings.
    console.error("agent-direct: Jev intent check unavailable", err);
    return null;
  }
}

async function book(supabase: SupabaseClient, body: Record<string, unknown>) {
  const input = validateBookingInput(body);
  if (!input.ok) return agentError(input.errors.join("; "), 400);
  const req: DirectBookingInput = input.value;
  const client = text(body.client, 64) || "unknown";
  const agentName = text(body.agentName, MAX_AGENT_NAME) || "AI assistant";
  const origin = SAFE_ORIGIN.test(text(body.origin, 200)) ? text(body.origin, 200) : DEFAULT_APP_ORIGIN;

  const business = await loadBookableBusiness(supabase, req.permalink);
  const log = (result: string, payload: Record<string, unknown>) =>
    logAgentEvent(supabase, { businessId: business.id, agentKeyId: null, action: DIRECT_BOOK_ACTION, payload: { client, agent: agentName, ...payload }, result });

  const limited = rateLimitReason(await recentAttempts(supabase, business.id, client));
  if (limited) return agentError(limited, 429);

  const blockedIntent = await intentBlocksBooking(req.customerRequest);
  if (blockedIntent) {
    await log("needs_confirmation", { reason: `intent_was_${blockedIntent}` });
    return agentJson({ needsConfirmation: true, reason: `intent_was_${blockedIntent}`, message: "The customer's words do not ask for a booking. Confirm with the customer first." }, 409);
  }

  const duration = await loadDuration(supabase, business.id, req.durationId);
  const slots = await freeSlots(supabase, business, duration, req.date);
  const slot = slots.find((s) => s.time === req.time && (!req.specialistId || s.specialistId === req.specialistId));
  if (!slot) {
    await log("slot_taken", { date: req.date, time: req.time });
    return agentJson({ error: "That time is no longer free.", freeTimes: slots.map((s) => s.time) }, 409);
  }

  const hold = await createHold(supabase, {
    businessId: business.id, serviceId: duration.service.id, durationId: duration.id, specialistId: slot.specialistId,
    date: req.date, startTime: slot.time, holdSeconds: business.agent_slot_hold_seconds, agentKeyId: null,
    customerEmail: req.email, customerName: req.name, customerPhone: req.phone,
  });
  const booking = await createBookingFromHold(supabase, {
    businessId: business.id, holdId: hold.id, consentPolicy: business.agent_consent_policy, aiAgent: agentName,
    notes: req.customerRequest ? `AI booking. Customer said: ${req.customerRequest}` : "AI booking",
  });
  const { approvalToken } = await recordAgentBooking(supabase, {
    businessId: business.id, bookingId: booking.id, agentKeyId: null, agentName, confidence: 1, source: "ai-booking-form",
  });

  const cancelUrl = `${origin}/cancel?id=${booking.id}`;
  const { data: staff } = await supabase.from("specialists").select("name").eq("id", slot.specialistId).maybeSingle();
  await Promise.all([
    notifyMerchantOfAgentBooking(supabase, { businessId: business.id, bookingId: booking.id, status: booking.status, approvalToken, agentName }),
    sendCustomerConfirmation(supabase, { business, duration, bookingId: booking.id, date: req.date, time: slot.time, name: req.name, email: req.email, specialistName: staff?.name ?? "", cancelUrl }),
    log(booking.status, { bookingId: booking.id }),
  ]);

  const isConfirmed = booking.status === "confirmed";
  return agentJson({
    bookingId: booking.id,
    status: booking.status,
    business: business.name,
    service: duration.service.name,
    date: req.date,
    time: slot.time,
    cancelUrl,
    message: isConfirmed
      ? `Booked: ${duration.service.name} at ${business.name} on ${req.date} at ${slot.time}. A confirmation email is on its way to ${req.email}.`
      : `Requested: ${duration.service.name} at ${business.name} on ${req.date} at ${slot.time}. The business confirms by email shortly.`,
  });
}

Deno.serve(async (req: Request) => {
  const options = handleAgentOptions(req);
  if (options) return options;
  if (req.method !== "POST") return agentError("Method not allowed", 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const supabase = publicServiceClient();
    if (body.action === "availability") return await availability(supabase, body);
    if (body.action === "book") return await book(supabase, body);
    return agentError('action must be "availability" or "book"', 400);
  } catch (err) {
    if (err instanceof DirectBookingError) return agentError(err.message, err.status);
    console.error("agent-direct failed", err);
    return agentError("Something went wrong. Please try again.", 500);
  }
});
