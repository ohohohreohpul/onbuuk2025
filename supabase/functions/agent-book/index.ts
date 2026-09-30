import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAgent, getBusinessConfig } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";
import { createBookingFromHold, logAgentEvent, recordAgentBooking } from "../_shared/agentBooking.ts";
import { notifyMerchantOfAgentBooking } from "../_shared/agentNotify.ts";
import {
  routeIntent,
  gateConfidence,
  isTypesafeConfigured,
  routeIntentFallback,
} from "../_shared/typesafe.ts";

// POST /agent/v1/book — convert a hold into a booking.
//
// Confidence gate: a booking is only created when either
//   (a) the caller sends confirm: true (explicit confirmation), or
//   (b) TypeSafe rates the booking intent confidence >= threshold.
// Otherwise the endpoint returns a clarification payload and creates nothing.

interface BookRequest {
  holdId: string;
  confirm?: boolean;
  /** Optional natural-language request, used to gauge intent confidence. */
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
    const body = (await req.json()) as BookRequest;

    if (!body.holdId) {
      return agentError("holdId is required", 400);
    }

    // Derive intent confidence from the natural-language request, if present.
    let confidence = 0;
    let intent = "book";
    if (body.request) {
      if (isTypesafeConfigured()) {
        try {
          const routed = await routeIntent(body.request);
          intent = routed.intent;
          confidence = routed.confidence;
        } catch {
          // Fail safe: require explicit confirm when TypeSafe is unreachable.
          confidence = 0;
        }
      } else {
        const fallback = routeIntentFallback(body.request);
        intent = fallback.intent;
        confidence = 0;
      }
    }

    if (intent !== "book") {
      return agentJson({
        needsConfirmation: true,
        reason: `intent_was_${intent}`,
        message:
          "The request does not look like a booking. Send confirm: true to override.",
      }, 409);
    }

    const gate = gateConfidence("book", confidence, body.confirm === true);
    if (!gate.proceed) {
      return agentJson({
        needsConfirmation: true,
        reason: gate.reason,
        confidence,
        message:
          "Booking intent is not confident enough. Re-send with confirm: true to create the booking.",
      }, 409);
    }

    const config = await getBusinessConfig(agent.supabase, agent.businessId);
    const booking = await createBookingFromHold(agent.supabase, {
      businessId: agent.businessId,
      holdId: body.holdId,
      consentPolicy: config.agent_consent_policy, aiAgent: agent.agentName,
      notes: body.notes,
    });

    const { approvalToken } = await recordAgentBooking(agent.supabase, {
      businessId: agent.businessId,
      bookingId: booking.id,
      agentKeyId: agent.agentKeyId,
      agentName: agent.agentName,
      confidence,
      source: "agent-api",
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
      action: "book",
      payload: { bookingId: booking.id, holdId: body.holdId, confirm: body.confirm === true },
      result: booking.status,
      confidence,
    });

    return agentJson({
      bookingId: booking.id,
      status: booking.status,
      date: booking.booking_date,
      startTime: booking.start_time,
      consent: config.agent_consent_policy,
      message:
        config.agent_consent_policy === "auto"
          ? "Booking confirmed."
          : "Booking created. Awaiting merchant confirmation.",
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return agentError(err instanceof Error ? err.message : String(err), status);
  }
});