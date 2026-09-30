import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAgent } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";
import { cancelBooking, logAgentEvent } from "../_shared/agentBooking.ts";
import {
  routeIntent,
  gateConfidence,
  isTypesafeConfigured,
  routeIntentFallback,
} from "../_shared/typesafe.ts";

// POST /agent/v1/cancel — cancel a booking by id + customer email.
// Confidence-gated like book: requires confirm:true or high intent confidence.

interface CancelRequest {
  bookingId: string;
  customerEmail: string;
  confirm?: boolean;
  request?: string;
}

Deno.serve(async (req: Request) => {
  const options = handleAgentOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return agentError("Method not allowed", 405);
  }

  try {
    const agent = await requireAgent(req);
    const body = (await req.json()) as CancelRequest;

    if (!body.bookingId || !body.customerEmail) {
      return agentError("bookingId and customerEmail are required", 400);
    }

    let confidence = 0;
    let intent = "cancel";
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

    if (intent !== "cancel") {
      return agentJson({
        needsConfirmation: true,
        reason: `intent_was_${intent}`,
        message: "Request does not look like a cancellation. Send confirm: true to override.",
      }, 409);
    }

    const gate = gateConfidence("cancel", confidence, body.confirm === true);
    if (!gate.proceed) {
      return agentJson({
        needsConfirmation: true,
        reason: gate.reason,
        confidence,
        message: "Cancellation not confident. Re-send with confirm: true.",
      }, 409);
    }

    const booking = await cancelBooking(agent.supabase, {
      businessId: agent.businessId,
      bookingId: body.bookingId,
      customerEmail: body.customerEmail,
    });

    await logAgentEvent(agent.supabase, {
      businessId: agent.businessId,
      agentKeyId: agent.agentKeyId,
      action: "cancel",
      payload: { bookingId: booking.id },
      result: booking.status,
      confidence,
    });

    return agentJson({ bookingId: booking.id, status: booking.status });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return agentError(err instanceof Error ? err.message : String(err), status);
  }
});