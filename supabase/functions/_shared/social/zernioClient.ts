/**
 * Zernio REST client (https://zernio.com/api/v1). Each shop is a Zernio profile
 * whose externalId is the Zenno business id. By default every shop uses Zenno's
 * platform key (ZERNIO_API_KEY); a shop with its own Zernio account
 * (private.zernio_connections) uses that key instead. Always get a client for the
 * shop with zernioFor(), never call Zernio with another shop's key.
 * ZERNIO_BASE_URL overrides the endpoint (staging points it at the zernio-mock function).
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isConnectPlatform, type ConnectPlatform } from "./zernioWebhook.ts";

const DEFAULT_BASE_URL = "https://zernio.com/api/v1";
const TIMEOUT_MS = 15_000;

export class ZernioError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null = null) {
    super(message);
  }
}

export interface ZernioInit {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}

/** A Zernio client bound to one API key. */
export type Zernio = <T = Record<string, unknown>>(path: string, init?: ZernioInit) => Promise<T>;

export function zernioWithKey(apiKey: string): Zernio {
  return async <T>(path: string, init: ZernioInit = {}): Promise<T> => {
    if (!apiKey) throw new ZernioError("Social is not set up yet (ZERNIO_API_KEY missing)", 503);
    const baseUrl = (Deno.env.get("ZERNIO_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const url = new URL(`${baseUrl}${path}`);
    for (const [name, value] of Object.entries(init.query ?? {})) url.searchParams.set(name, value);
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${apiKey}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!response.ok) {
      const message = String(data.error ?? data.message ?? `Zernio ${response.status}`);
      console.error(`zernio ${init.method ?? "GET"} ${path} -> ${response.status}: ${message}`);
      throw new ZernioError(message, response.status, typeof data.code === "string" ? data.code : null);
    }
    return data as T;
  };
}

/** Zenno's own Zernio account (shops without their own). */
export const platformZernio = (): Zernio => zernioWithKey(Deno.env.get("ZERNIO_API_KEY") ?? "");

/** The shop's own Zernio connection id, or null when it uses Zenno's account. */
export async function zernioConnectionOf(supabase: SupabaseClient, businessId: string): Promise<{ connectionId: string; apiKey: string } | null> {
  const { data, error } = await supabase.rpc("zernio_credentials", { p_business_id: businessId });
  if (error) throw new Error(`zernio credentials lookup failed: ${error.message}`);
  const row = (data as { connection_id: string; api_key: string }[] | null)?.[0];
  return row ? { connectionId: row.connection_id, apiKey: row.api_key } : null;
}

/** The Zernio client for this shop: its own account if it connected one, else Zenno's. */
export async function zernioFor(supabase: SupabaseClient, businessId: string): Promise<Zernio> {
  const own = await zernioConnectionOf(supabase, businessId);
  return own ? zernioWithKey(own.apiKey) : platformZernio();
}

/** The shop's Zernio profile, created on first use (externalId = business id). */
export async function ensureProfile(supabase: SupabaseClient, businessId: string, shopName: string): Promise<string> {
  const { data: existing } = await supabase.from("social_profiles").select("zernio_profile_id").eq("business_id", businessId).maybeSingle();
  if (existing?.zernio_profile_id) return existing.zernio_profile_id as string;

  const zernio = await zernioFor(supabase, businessId);
  const found = await zernio<{ profiles: { _id: string }[] }>("/profiles", { query: { externalId: businessId } });
  let profileId: string | null = found.profiles?.[0]?._id ?? null;
  if (!profileId) {
    const created = await zernio<{ profile?: { _id: string } }>("/profiles", {
      method: "POST",
      body: { name: `Zenno · ${shopName}`.slice(0, 100), externalId: businessId, description: "Zenno shop" },
    });
    profileId = created.profile?._id ?? null;
  }
  if (!profileId) throw new ZernioError("Zernio did not return a profile id", 502);
  const { error } = await supabase.from("social_profiles").upsert({ business_id: businessId, zernio_profile_id: profileId });
  if (error) throw new Error(`could not store social profile: ${error.message}`);
  return profileId;
}

interface ZernioAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string | null;
  isActive?: boolean;
}

/** Mirror the profile's Instagram, Facebook and Google Business Profile accounts into social_accounts. */
export async function syncAccounts(supabase: SupabaseClient, businessId: string, profileId: string): Promise<void> {
  const zernio = await zernioFor(supabase, businessId);
  const { accounts } = await zernio<{ accounts: ZernioAccount[] }>("/accounts", { query: { profileId } });
  const social = (accounts ?? []).filter((a) => isConnectPlatform(a.platform));
  const ids = social.map((a) => a._id);
  if (social.length) {
    const { error } = await supabase.from("social_accounts").upsert(social.map((a) => ({
      business_id: businessId,
      zernio_account_id: a._id,
      platform: a.platform as ConnectPlatform,
      username: a.username?.slice(0, 200) ?? null,
      display_name: a.displayName?.slice(0, 200) ?? null,
      picture_url: a.profilePicture?.slice(0, 2000) ?? null,
      is_active: a.isActive !== false,
      updated_at: new Date().toISOString(),
    })), { onConflict: "zernio_account_id" });
    if (error) throw new Error(`could not store social accounts: ${error.message}`);
  }
  // Accounts disconnected in Zernio stay as rows (history) but are marked inactive.
  let stale = supabase.from("social_accounts").update({ is_active: false, updated_at: new Date().toISOString() }).eq("business_id", businessId);
  if (ids.length) stale = stale.not("zernio_account_id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`);
  const { error: staleError } = await stale;
  if (staleError) console.error("could not mark disconnected social accounts:", staleError);
}

/** Send one DM into a Zernio inbox conversation. */
export async function sendSocialMessage(zernio: Zernio, conversationId: string, accountId: string, message: string): Promise<string | null> {
  const result = await zernio<{ data?: { messageId?: string } }>(
    `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: { accountId, message } },
  );
  return result.data?.messageId ?? null;
}
