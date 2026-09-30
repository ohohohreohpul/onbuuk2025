import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAgent, getBusinessConfig } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";
import {
  cancelBooking,
  createHold,
  createBookingFromHold,
  logAgentEvent,
  recordAgentBooking,
} from "../_shared/agentBooking.ts";
import { notifyMerchantOfAgentBooking } from "../_shared/agentNotify.ts";
import {
  routeIntent,
  gateConfidence,
  isTypesafeConfigured,
  routeIntentFallback,
} from "../_shared/typesafe.ts";

// POST /agent/v1/reschedule — move an existing booking to a new slot.
// Cancels the old booking, places a hold on the new slot, then books it.
// Confidence-gated: requires confirm:true or high reschedule-intent confidence.

interface RescheduleRequest {
  bookingId: string;
  customerEmail: string;
  // New slot details:
  serviceId: string;
  durationId: string;
  specialistId: string;
  date: string;
  startTime: string;
  customerName?: string;
  customerPhone?: string;
  confirm?: boolean;
  request?: string;
  notes?: string;
}

Deno.serve(async (req: Request) => {
  const options = handleAgentOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return agentError("Method not allowed", 405);
  }

  try {
    const agent = await requireAgent(req);
    const body = (await req.json()) as RescheduleRequest;

    const missing = [
      "bookingId", "customerEmail", "serviceId", "durationId",
      "specialistId", "date", "startTime",
    ].filter((k) => !body[k as keyof RescheduleRequest]);
    if (missing.length) {
      return agentError(`Missing fields: ${missing.join(", ")}`, 400);
    }

    let confidence = 0;
    let intent = "reschedule";
    if (body.request) {
      if (isTypesafeConfigured()) {
        try {
          const routed = await routeIntent(body.request);
          intent = routed.intent;
          confidence = routed.confidence;
        } catch {
          confidence = 0;
        }
      } else {
        const fallback = routeIntentFallback(body.request);
        intent = fallback.intent;
        confidence = 0;
      }
    }

    if (intent !== "reschedule") {
      return agentJson({
        needsConfirmation: true,
        reason: `intent_was_${intent}`,
        message: "Request does not look like a reschedule. Send confirm: true to override.",
      }, 409);
    }

    const gate = gateConfidence("reschedule", confidence, body.confirm === true);
    if (!gate.proceed) {
      return agentJson({
        needsConfirmation: true,
        reason: gate.reason,
        confidence,
        message: "Reschedule not confident. Re-send with confirm: true.",
      }, 409);
    }

    const config = await getBusinessConfig(agent.supabase, agent.businessId);

    // 1. Cancel the existing booking.
    const cancelled = await cancelBooking(agent.supabase, {
      businessId: agent.businessId,
      bookingId: body.bookingId,
      customerEmail: body.customerEmail,
    });

    // 2. Hold the new slot.
    const hold = await createHold(agent.supabase, {
      businessId: agent.businessId,
      serviceId: body.serviceId,
      durationId: body.durationId,
      specialistId: body.specialistId,
      date: body.date,
      startTime: body.startTime,
      holdSeconds: config.agent_slot_hold_seconds,
      agentKeyId: agent.agentKeyId,
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
    });

    // 3. Book the new slot.
    const booking = await createBookingFromHold(agent.supabase, {
      businessId: agent.businessId,
      holdId: hold.id,
      consentPolicy: config.agent_consent_policy, aiAgent: agent.agentName,
      notes: body.notes ?? `Rescheduled from booking ${body.bookingId}`,
    });

    const { approvalToken } = await recordAgentBooking(agent.supabase, {
      businessId: agent.businessId,
      bookingId: booking.id,
      agentKeyId: agent.agentKeyId,
      agentName: agent.agentName,
      confidence,
      source: "agent-api-reschedule",
    });

    await notifyMerchantOfAgentBooking(agent.supabase, {
      businessId: agent.businessId,
      bookingId: booking.id,
      status: booking.status,
      approvalToken,
      agentName: agent.agentName,
    });

    await logAgentEvent(agent.supabase, {
      businessId: agent.businessId,
      agentKeyId: agent.agentKeyId,
      action: "reschedule",
      payload: { fromBookingId: cancelled.id, toBookingId: booking.id },
      result: booking.status,
      confidence,
    });

    return agentJson({
      bookingId: booking.id,
      previousBookingId: cancelled.id,
      status: booking.status,
      date: booking.booking_date,
      startTime: booking.start_time,
      consent: config.agent_consent_policy,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return agentError(err instanceof Error ? err.message : String(err), status);
  }
});