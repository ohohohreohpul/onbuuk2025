import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Agent API key authentication + rate limiting
// ---------------------------------------------------------------------------

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 120;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

export interface AuthenticatedAgent {
  businessId: string;
  agentKeyId: string;
  agentName: string;
  supabase: SupabaseClient;
}

export class AgentAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AgentAuthError";
  }
}

function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new AgentAuthError("Server is not configured for agent access", 500);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function checkRateLimit(agentKeyId: string): void {
  const now = Date.now();
  const bucket = rateBuckets.get(agentKeyId);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(agentKeyId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  bucket.count += 1;
  if (bucket.count > RATE_MAX_REQUESTS) {
    throw new AgentAuthError("Rate limit exceeded", 429);
  }
}

/**
 * Validates the X-Agent-Key header, resolves the business, and returns a
 * service-role client scoped to that business. Throws AgentAuthError on
 * missing/revoked keys, disabled agent access, or rate limits.
 */
export async function requireAgent(req: Request): Promise<AuthenticatedAgent> {
  const agentKey = req.headers.get("X-Agent-Key");
  if (!agentKey) {
    throw new AgentAuthError("Missing X-Agent-Key header", 401);
  }

  const supabase = serviceClient();
  const keyHash = await sha256Hex(agentKey);

  const { data: keyRow, error } = await supabase
    .from("agent_api_keys")
    .select("id, business_id, label, revoked_at, businesses(id, agent_enabled, agent_consent_policy, agent_lead_time_minutes, agent_slot_hold_seconds)")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRow || keyRow.revoked_at) {
    throw new AgentAuthError("Invalid or revoked agent API key", 401);
  }

  const business = keyRow.businesses as unknown as {
    id: string;
    agent_enabled: boolean;
    agent_consent_policy: "auto" | "manual";
    agent_lead_time_minutes: number;
    agent_slot_hold_seconds: number;
  } | null;

  if (!business || !business.agent_enabled) {
    throw new AgentAuthError("This business is not agent-bookable", 403);
  }

  checkRateLimit(keyRow.id);

  // Best-effort: stamp last_used_at without blocking the response path.
  supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {}, () => {});

  return {
    businessId: business.id,
    agentKeyId: keyRow.id,
    agentName: keyRow.label ?? "agent",
    supabase,
  };
}

/** Public businesses need no key. Used by search + manifest. */
export function publicServiceClient(): SupabaseClient {
  return serviceClient();
}

export interface PublicBusinessConfig {
  agent_consent_policy: "auto" | "manual";
  agent_lead_time_minutes: number;
  agent_slot_hold_seconds: number;
}

export async function getBusinessConfig(
  supabase: SupabaseClient,
  businessId: string,
): Promise<PublicBusinessConfig> {
  const { data, error } = await supabase
    .from("businesses")
    .select("agent_consent_policy, agent_lead_time_minutes, agent_slot_hold_seconds")
    .eq("id", businessId)
    .maybeSingle();
  if (error || !data) {
    throw new AgentAuthError("Business configuration not found", 404);
  }
  return data as PublicBusinessConfig;
}