import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { isServiceRoleRequest } from "../_shared/adminAuthorization.ts";
import { GbpActionError, pushProfile, type GbpSettingsRow } from "../_shared/social/gbpService.ts";

// Cron (every 5 minutes while something is due): pushes opening hours and the
// service list to Google for shops whose hours/services changed (gbp_settings.sync_due_at,
// set by triggers). Only shops that still have local SEO are synced; a failure is
// stored on the shop (last_sync_error) and retried after RETRY_MINUTES.

const BATCH = 10;
const RETRY_MINUTES = 30;
const TIME_BUDGET_MS = 50_000;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("OUTBOX_CRON_SECRET") ?? "";
  return (secret.length >= 32 && timingSafeEqual(req.headers.get("x-cron-secret") ?? "", secret)) || isServiceRoleRequest(req);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isAuthorized(req)) return new Response("Unauthorized", { status: 401 });

  const supabase = publicServiceClient();
  const started = Date.now();
  const { data: due, error } = await supabase.from("gbp_settings")
    .select("business_id, auto_reply_positive, auto_reply_since, sync_hours, sync_services")
    .lte("sync_due_at", new Date().toISOString()).order("sync_due_at").limit(BATCH);
  if (error) {
    console.error("local-seo-sync: queue lookup failed", error);
    return new Response(JSON.stringify({ error: "queue lookup failed" }), { status: 500 });
  }

  const results: { businessId: string; ok: boolean }[] = [];
  for (const settings of (due ?? []) as GbpSettingsRow[]) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const businessId = settings.business_id;
    const { data: allowed } = await supabase.rpc("business_has_local_seo", { p_business_id: businessId });
    if (allowed !== true) {
      await supabase.from("gbp_settings").update({ sync_due_at: null }).eq("business_id", businessId);
      continue;
    }
    try {
      await pushProfile(supabase, businessId, settings);
      await supabase.from("gbp_settings").update({
        sync_due_at: null, last_synced_at: new Date().toISOString(), last_sync_error: null, updated_at: new Date().toISOString(),
      }).eq("business_id", businessId);
      results.push({ businessId, ok: true });
    } catch (syncError) {
      // Google was disconnected: nothing to retry until it is connected again.
      const retryAt = syncError instanceof GbpActionError ? null : new Date(Date.now() + RETRY_MINUTES * 60_000).toISOString();
      console.error(`local-seo-sync: shop ${businessId} failed`, syncError);
      await supabase.from("gbp_settings").update({
        sync_due_at: retryAt,
        last_sync_error: String(syncError instanceof Error ? syncError.message : syncError).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("business_id", businessId);
      results.push({ businessId, ok: false });
    }
  }
  return new Response(JSON.stringify({ synced: results }), { headers: { "Content-Type": "application/json" } });
});
