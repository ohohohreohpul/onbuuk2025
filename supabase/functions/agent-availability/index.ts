import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { requireAgent, getBusinessConfig } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";
import { getAvailableSlots } from "../_shared/agentBooking.ts";

// POST /agent/v1/availability — live availability for a service/duration/
// specialist on a date. Requires X-Agent-Key.

interface AvailabilityRequest {
  serviceId: string;
  durationMinutes: number;
  specialistId?: string;
  date: string; // YYYY-MM-DD
}

Deno.serve(async (req: Request) => {
  const options = handleAgentOptions(req);
  if (options) return options;

  if (req.method !== "POST") {
    return agentError("Method not allowed", 405);
  }

  try {
    const agent = await requireAgent(req);
    const body = (await req.json()) as AvailabilityRequest;

    if (!body.serviceId || !body.durationMinutes || !body.date) {
      return agentError("serviceId, durationMinutes and date are required", 400);
    }

    // Respect the business lead-time policy: don't return slots before the
    // configured lead time.
    const config = await getBusinessConfig(agent.supabase, agent.businessId);
    const minDate = new Date(Date.now() + config.agent_lead_time_minutes * 60_000);
    const requested = new Date(`${body.date}T00:00:00`);
    if (requested < minDate) {
      return agentJson({
        slots: [],
        note: `This business requires ${config.agent_lead_time_minutes} minutes lead time.`,
      });
    }

    // If no specialist given, aggregate across all active specialists.
    let specialistIds: string[] = [];
    if (body.specialistId) {
      specialistIds = [body.specialistId];
    } else {
      const { data: specialists } = await agent.supabase
        .from("specialists")
        .select("id")
        .eq("business_id", agent.businessId)
        .eq("is_active", true);
      specialistIds = (specialists ?? []).map((s) => s.id);
    }

    if (specialistIds.length === 0) {
      return agentJson({ slots: [], note: "No active specialists." });
    }

    const perSpecialist = await Promise.all(
      specialistIds.map((id) =>
        getAvailableSlots(agent.supabase, {
          businessId: agent.businessId,
          serviceId: body.serviceId,
          durationMinutes: body.durationMinutes,
          specialistId: id,
          date: body.date,
        }).then((slots) => ({ specialistId: id, slots })),
      ),
    );

    // De-duplicate slot times across specialists; keep a count of availability.
    const slotMap = new Map<string, { time: string; startsAt: string; availableSpecialists: number }>();
    for (const { specialistId, slots } of perSpecialist) {
      for (const slot of slots) {
        const existing = slotMap.get(slot.time);
        if (existing) {
          existing.availableSpecialists += 1;
        } else {
          slotMap.set(slot.time, {
            time: slot.time,
            startsAt: slot.startsAt,
            availableSpecialists: 1,
          });
        }
      }
      void specialistId;
    }

    const slots = Array.from(slotMap.values()).sort((a, b) =>
      a.time.localeCompare(b.time),
    );

    return agentJson({ date: body.date, slots });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return agentError(err instanceof Error ? err.message : String(err), status);
  }
});