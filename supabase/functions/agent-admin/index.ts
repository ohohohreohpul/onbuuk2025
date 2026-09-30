import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  requireActiveAdmin,
  authorizationErrorResponse,
} from "../_shared/adminAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `za_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authorized = await requireActiveAdmin(req);
    const { supabaseAdmin, businessId } = authorized;
    const body = (await req.json().catch(() => ({}))) as { action: string; payload?: any };

    switch (body.action) {
      case "get_settings": {
        const { data, error } = await supabaseAdmin
          .from("businesses")
          .select(
            "agent_enabled, agent_consent_policy, agent_lead_time_minutes, agent_slot_hold_seconds, vertical, city, address_line, agent_description",
          )
          .eq("id", businessId)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        return json({ settings: data });
      }

      case "update_settings": {
        const allowed = [
          "agent_enabled", "agent_consent_policy", "agent_lead_time_minutes",
          "agent_slot_hold_seconds", "vertical", "city", "address_line",
          "agent_description",
        ];
        const update: Record<string, unknown> = {};
        for (const k of allowed) {
          if (k in (body.payload ?? {})) update[k] = body.payload[k];
        }
        const { data, error } = await supabaseAdmin
          .from("businesses")
          .update(update)
          .eq("id", businessId)
          .select(
            "agent_enabled, agent_consent_policy, agent_lead_time_minutes, agent_slot_hold_seconds, vertical, city, address_line, agent_description",
          )
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        return json({ settings: data });
      }

      case "list_keys": {
        const { data, error } = await supabaseAdmin
          .from("agent_api_keys")
          .select("id, key_prefix, label, last_used_at, created_at, revoked_at")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ keys: data });
      }

      case "create_key": {
        const rawKey = randomKey();
        const keyHash = await sha256Hex(rawKey);
        const keyPrefix = rawKey.slice(0, 10);
        const label = body.payload?.label ?? "Agent key";
        const { data, error } = await supabaseAdmin
          .from("agent_api_keys")
          .insert({ business_id: businessId, key_hash: keyHash, key_prefix: keyPrefix, label })
          .select("id, key_prefix, label, created_at")
          .single();
        if (error) return json({ error: error.message }, 500);
        // The raw key is shown exactly once.
        return json({ key: rawKey, record: data });
      }

      case "revoke_key": {
        const { error } = await supabaseAdmin
          .from("agent_api_keys")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", body.payload?.keyId)
          .eq("business_id", businessId)
          .is("revoked_at", null);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      case "list_agent_bookings": {
        const { data, error } = await supabaseAdmin
          .from("agent_bookings")
          .select(
            "id, booking_id, agent_name, confidence, source, created_at, bookings!inner(status, booking_date, start_time, customer_name)",
          )
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return json({ error: error.message }, 500);
        return json({ bookings: data });
      }

      case "list_events": {
        const { data, error } = await supabaseAdmin
          .from("agent_events")
          .select("id, action, result, confidence, created_at, payload")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 500);
        return json({ events: data });
      }

      default:
        return json({ error: `Unknown action: ${body.action}` }, 400);
    }
  } catch (err) {
    const authErr = authorizationErrorResponse(err, corsHeaders);
    if (authErr) return authErr;
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});