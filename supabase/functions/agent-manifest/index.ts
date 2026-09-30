import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";

// GET /agent/v1/manifest?permalink=<permalink>
// Returns a static, agent-readable manifest: services, durations, hours,
// location, consent policy. Public; no API key required.

Deno.serve(async (req: Request) => {
  const options = handleAgentOptions(req);
  if (options) return options;

  try {
    const url = new URL(req.url);
    const permalink = url.searchParams.get("permalink");
    if (!permalink) {
      return agentError("permalink query parameter is required", 400);
    }

    const supabase = publicServiceClient();

    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select(
        "id, name, permalink, vertical, city, address_line, agent_description, agent_enabled, agent_consent_policy, agent_lead_time_minutes",
      )
      .eq("permalink", permalink)
      .eq("is_active", true)
      .maybeSingle();

    if (bizError || !business) {
      return agentError("Business not found", 404);
    }

    const [services, specialists] = await Promise.all([
      supabase
        .from("services")
        .select("id, name, description, category, is_pair_massage")
        .eq("business_id", business.id)
        .order("display_order"),
      supabase
        .from("specialists")
        .select("id, name, bio, is_active")
        .eq("business_id", business.id),
    ]);

    const serviceIds = (services.data ?? []).map((s) => s.id);
    const durations = serviceIds.length
      ? await supabase
          .from("service_durations")
          .select("id, service_id, duration_minutes, price_cents")
          .in("service_id", serviceIds)
      : { data: [], error: null };

    const specialistIds = (specialists.data ?? []).map((s) => s.id);
    const workingHours = specialistIds.length
      ? await supabase
          .from("working_hours")
          .select("specialist_id, day_of_week, start_time, end_time, is_available")
          .in("specialist_id", specialistIds)
      : { data: [], error: null };

    const manifest = {
      schema: "zenno.agent.v1",
      business: {
        name: business.name,
        permalink: business.permalink,
        vertical: business.vertical,
        location: {
          city: business.city,
          address: business.address_line,
        },
        description: business.agent_description,
        agent_enabled: business.agent_enabled,
        booking_policy: {
          consent: business.agent_consent_policy,
          lead_time_minutes: business.agent_lead_time_minutes,
        },
      },
      services: (services.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        pair_booking: s.is_pair_massage,
        durations: (durations.data ?? [])
          .filter((d) => d.service_id === s.id)
          .map((d) => ({
            id: d.id,
            minutes: d.duration_minutes,
            price_cents: d.price_cents,
          })),
      })),
      specialists: (specialists.data ?? []).map((sp) => ({
        id: sp.id,
        name: sp.name,
        bio: sp.bio,
        active: sp.is_active,
        working_hours: (workingHours.data ?? [])
          .filter((wh) => wh.specialist_id === sp.id)
          .sort((a, b) => a.day_of_week - b.day_of_week)
          .map((wh) => ({
            day: wh.day_of_week,
            start: wh.start_time,
            end: wh.end_time,
            available: wh.is_available,
          })),
      })),
      actions: {
        search: "POST /agent/v1/search",
        manifest: "GET /agent/v1/manifest?permalink=<permalink>",
        availability: "POST /agent/v1/availability  (requires X-Agent-Key)",
        hold: "POST /agent/v1/hold  (requires X-Agent-Key)",
        book: "POST /agent/v1/book  (requires X-Agent-Key, confidence-gated)",
        cancel: "POST /agent/v1/cancel  (requires X-Agent-Key)",
        reschedule: "POST /agent/v1/reschedule  (requires X-Agent-Key)",
      },
    };

    return agentJson(manifest);
  } catch (err) {
    return agentError("Internal error", 500, String(err));
  }
});