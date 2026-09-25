import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  authorizationErrorResponse,
  requireActiveAdmin,
} from "../_shared/adminAuthorization.ts";
import { parseBusySpans } from "../_shared/icsBusy.ts";
import { fetchCalendarText, UnsafeUrlError } from "../_shared/safeFetch.ts";

// Reads shops' external calendars (Google, Outlook, Apple, Treatwell … any iCal
// link) and stores their busy times, so the booking page never offers a time
// that is already taken elsewhere.
//
// Two callers:
//   - pg_cron every 10 minutes, header x-calendar-sync-secret → all due calendars
//   - an admin pressing "Sync now" (JWT) → { calendar_id? } of their own business

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LOOK_BACK_DAYS = 1;
const LOOK_AHEAD_DAYS = 90;
/** Calendars synced per cron run; the oldest are refreshed first. */
const CRON_BATCH_SIZE = 40;
const PARALLEL_FETCHES = 5;

interface CalendarRow {
  id: string;
  business_id: string;
  provider: string;
  ics_url: string | null;
}

interface SyncResult {
  calendar_id: string;
  busy_count?: number;
  error?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function friendlyError(error: unknown): string {
  if (error instanceof UnsafeUrlError) return error.message;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "The calendar server took too long to answer.";
  }
  if (error instanceof Error) return error.message.slice(0, 300);
  return "The calendar could not be read.";
}

async function syncOne(supabase: SupabaseClient, calendar: CalendarRow): Promise<SyncResult> {
  if (calendar.provider !== "ics" || !calendar.ics_url) {
    return { calendar_id: calendar.id, error: "Live Google connection is not set up yet." };
  }

  const now = Date.now();
  const window = {
    from: new Date(now - LOOK_BACK_DAYS * 86_400_000),
    to: new Date(now + LOOK_AHEAD_DAYS * 86_400_000),
  };

  try {
    const text = await fetchCalendarText(calendar.ics_url);
    const spans = parseBusySpans(text, window);
    const { data, error } = await supabase.rpc("replace_external_busy_times", {
      p_calendar_id: calendar.id,
      p_spans: spans,
    });
    if (error) throw new Error(`Saving busy times failed: ${error.message}`);
    return { calendar_id: calendar.id, busy_count: data as number };
  } catch (error) {
    const message = friendlyError(error);
    console.error("Calendar sync failed", { calendar_id: calendar.id, message });
    await supabase.rpc("replace_external_busy_times", {
      p_calendar_id: calendar.id,
      p_spans: [],
      p_error: message,
    });
    return { calendar_id: calendar.id, error: message };
  }
}

async function syncAll(supabase: SupabaseClient, calendars: CalendarRow[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (let i = 0; i < calendars.length; i += PARALLEL_FETCHES) {
    const batch = calendars.slice(i, i + PARALLEL_FETCHES);
    results.push(...(await Promise.all(batch.map((calendar) => syncOne(supabase, calendar)))));
  }
  return results;
}

async function handleCron(supabase: SupabaseClient, secret: string): Promise<Response> {
  const { data: matches } = await supabase.rpc("calendar_sync_secret_matches", { p_secret: secret });
  if (matches !== true) return json({ error: "Forbidden" }, 403);

  const { data, error } = await supabase
    .from("external_calendars")
    .select("id, business_id, provider, ics_url")
    .eq("is_active", true)
    .eq("provider", "ics")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(CRON_BATCH_SIZE);
  if (error) throw error;

  const results = await syncAll(supabase, (data ?? []) as CalendarRow[]);
  return json({ synced: results.length, failed: results.filter((r) => r.error).length });
}

async function handleAdmin(req: Request): Promise<Response> {
  const { businessId, supabaseAdmin } = await requireActiveAdmin(req);
  const body = await req.json().catch(() => ({})) as { calendar_id?: unknown };
  const calendarId = typeof body.calendar_id === "string" ? body.calendar_id : null;

  let query = supabaseAdmin
    .from("external_calendars")
    .select("id, business_id, provider, ics_url")
    .eq("business_id", businessId)
    .eq("is_active", true);
  if (calendarId) query = query.eq("id", calendarId);

  const { data, error } = await query.limit(CRON_BATCH_SIZE);
  if (error) throw error;
  if (calendarId && (!data || data.length === 0)) return json({ error: "Calendar not found" }, 404);

  return json({ results: await syncAll(supabaseAdmin, (data ?? []) as CalendarRow[]) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = req.headers.get("x-calendar-sync-secret");
    if (secret) return await handleCron(serviceClient(), secret);
    return await handleAdmin(req);
  } catch (error) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    console.error("sync-external-calendars error", error);
    return json({ error: "Calendar sync failed" }, 500);
  }
});
