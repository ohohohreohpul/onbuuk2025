import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAgent, getBusinessConfig } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";
import { createHold, logAgentEvent } from "../_shared/agentBooking.ts";

// POST /agent/v1/hold — tentatively hold a slot with a TTL.
// Idempotent on (specialist, date, start_time, customer_email).

interface HoldRequest {
  serviceId: string;
  durationId: string;
  specialistId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "HH:MM"
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
}

Deno.serve(async (req: Request) => {
  const options = handleAgentOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return agentError("Method not allowed", 405);
  }

  try {
    const agent = await requireAgent(req);
    const body = (await req.json()) as HoldRequest;

    const missing = [
      "serviceId", "durationId", "specialistId", "date", "startTime",
      "customerEmail",
    ].filter((k) => !body[k as keyof HoldRequest]);
    if (missing.length) {
      return agentError(`Missing fields: ${missing.join(", ")}`, 400);
    }

    const config = await getBusinessConfig(agent.supabase, agent.businessId);

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

    await logAgentEvent(agent.supabase, {
      businessId: agent.businessId,
      agentKeyId: agent.agentKeyId,
      action: "hold",
      payload: { holdId: hold.id, slot: { date: body.date, time: body.startTime } },
      result: "held",
    });

    return agentJson({
      holdId: hold.id,
      heldUntil: hold.held_until,
      slot: { date: body.date, startTime: body.startTime },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return agentError(err instanceof Error ? err.message : String(err), status);
  }
});