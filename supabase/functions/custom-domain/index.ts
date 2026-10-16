import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { authorizationErrorResponse, requireActiveAdmin } from "../_shared/adminAuthorization.ts";

// A shop's own domain (paid plans), served by the Vercel project of the app.
// POST { action: "add" | "check" | "remove", domain }
//   add    -> adds the domain to Vercel, stores it as pending, returns the DNS records to set
//   check  -> asks Vercel whether DNS is right; verified domains start serving the shop
//   remove -> removes it from Vercel and from the shop
// Secrets: VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

class InputError extends Error {}

const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PLATFORM = /(^|\.)(zennohq\.(com|studio)|onbuuk\.com|vercel\.app|supabase\.co)$/;
const VERCEL_TIMEOUT_MS = 10_000;

export interface DnsRecord { type: string; name: string; value: string }

function normalizeDomain(input: unknown): string {
  const domain = String(input ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (!DOMAIN.test(domain)) throw new InputError("Please enter a domain like booking.my-spa.de");
  if (PLATFORM.test(domain)) throw new InputError("This address belongs to Zenno. Please use your own domain.");
  return domain;
}

async function vercel(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const token = Deno.env.get("VERCEL_TOKEN");
  const team = Deno.env.get("VERCEL_TEAM_ID");
  if (!token || !Deno.env.get("VERCEL_PROJECT_ID") || !team) throw new Error("Vercel is not configured");
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`https://api.vercel.com${path}${separator}teamId=${encodeURIComponent(team)}`, {
    ...init,
    signal: AbortSignal.timeout(VERCEL_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const project = () => encodeURIComponent(Deno.env.get("VERCEL_PROJECT_ID") ?? "");

/** The records the owner sets at their domain provider. */
function dnsRecords(domain: string, verification: unknown): DnsRecord[] {
  const isApex = domain.split(".").length === 2;
  const records: DnsRecord[] = isApex
    ? [{ type: "A", name: "@", value: "76.76.21.21" }]
    : [{ type: "CNAME", name: domain.split(".").slice(0, -2).join("."), value: "cname.vercel-dns.com" }];
  for (const item of Array.isArray(verification) ? verification : []) {
    const v = item as { type?: string; domain?: string; value?: string };
    if (v.type && v.domain && v.value) records.push({ type: v.type, name: v.domain, value: v.value });
  }
  return records;
}

async function addDomain(businessId: string, domain: string) {
  const { data: taken } = await supabase.from("custom_domains").select("business_id").ilike("domain", domain).maybeSingle();
  if (taken && taken.business_id !== businessId) throw new InputError("This domain is already used by another shop.");
  const added = await vercel(`/v10/projects/${project()}/domains`, { method: "POST", body: JSON.stringify({ name: domain }) });
  const code = (added.body.error as { code?: string } | undefined)?.code;
  if (added.status >= 400 && code !== "domain_already_in_use" && code !== "domain_already_exists") {
    console.error("vercel add domain failed:", added.status, added.body.error);
    throw new InputError("The domain could not be added. Please check it and try again.");
  }
  if (!taken) {
    const { error } = await supabase.from("custom_domains").insert({ business_id: businessId, domain, status: "pending" });
    if (error) throw new Error(`custom_domains insert failed: ${error.message}`);
  }
  return checkDomain(businessId, domain);
}

async function checkDomain(businessId: string, domain: string) {
  const { data: row } = await supabase.from("custom_domains").select("id, status").eq("business_id", businessId).ilike("domain", domain).maybeSingle();
  if (!row) throw new InputError("Domain not found.");
  const [info, config] = await Promise.all([
    vercel(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`),
    vercel(`/v6/domains/${encodeURIComponent(domain)}/config`),
  ]);
  const isVerified = info.body.verified === true && config.body.misconfigured === false;
  const now = new Date().toISOString();
  if (isVerified && row.status !== "verified") {
    const { count } = await supabase.from("custom_domains").select("id", { count: "exact", head: true })
      .eq("business_id", businessId).eq("status", "verified").eq("is_primary", true);
    await supabase.from("custom_domains").update({
      status: "verified", verified_at: now, last_checked_at: now, error_message: null, is_primary: (count ?? 0) === 0, updated_at: now,
    }).eq("id", row.id);
  } else {
    await supabase.from("custom_domains").update({ last_checked_at: now, updated_at: now }).eq("id", row.id);
  }
  return { domain, isVerified, records: dnsRecords(domain, info.body.verification) };
}

async function removeDomain(businessId: string, domain: string) {
  const { data: row } = await supabase.from("custom_domains").select("id").eq("business_id", businessId).ilike("domain", domain).maybeSingle();
  if (!row) throw new InputError("Domain not found.");
  const removed = await vercel(`/v9/projects/${project()}/domains/${encodeURIComponent(domain)}`, { method: "DELETE" });
  if (removed.status >= 400 && removed.status !== 404) console.error("vercel remove domain failed:", removed.status, removed.body.error);
  const { error } = await supabase.from("custom_domains").delete().eq("id", row.id);
  if (error) throw new Error(`custom_domains delete failed: ${error.message}`);
  return { removed: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = await requireActiveAdmin(req, { roles: ["owner", "admin"] });
    const body = await req.json().catch(() => ({})) as { action?: string; domain?: string };
    const domain = normalizeDomain(body.domain);
    if (body.action === "remove") return json(await removeDomain(admin.businessId, domain));
    const { data: isPaid } = await supabase.rpc("business_is_paid", { p_business_id: admin.businessId });
    if (isPaid !== true) throw new InputError("Your own domain is part of the Zenno plan.");
    if (body.action === "add") return json(await addDomain(admin.businessId, domain));
    if (body.action === "check") return json(await checkDomain(admin.businessId, domain));
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    if (error instanceof InputError) return json({ error: error.message }, 400);
    console.error("custom-domain failed:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
