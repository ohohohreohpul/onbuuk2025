// Abuse and cost limits for the AI receptionist (atomic, in the database).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_DAILY_TOKEN_BUDGET = 2_000_000;

/** One hit on a fixed-window counter; false = over the limit. Fails open only on infrastructure errors. */
export async function withinLimit(supabase: SupabaseClient, key: string, windowSeconds: number, limit: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("receptionist_rate_hit", { p_key: key, p_window_seconds: windowSeconds, p_limit: limit });
  if (error) {
    console.error("rate limiter unavailable:", error);
    return true;
  }
  return data === true;
}

/** Per-shop daily AI budget (RECEPTIONIST_DAILY_TOKEN_BUDGET, default 2M tokens). */
export async function isOverTokenBudget(supabase: SupabaseClient, businessId: string): Promise<boolean> {
  const budget = Number(Deno.env.get("RECEPTIONIST_DAILY_TOKEN_BUDGET") ?? DEFAULT_DAILY_TOKEN_BUDGET);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data, error } = await supabase.from("receptionist_usage").select("prompt_tokens, completion_tokens")
    .eq("business_id", businessId).gte("created_at", since).limit(10_000);
  if (error) {
    console.error("token budget lookup failed:", error);
    return false;
  }
  const used = (data ?? []).reduce((sum, row) => sum + row.prompt_tokens + row.completion_tokens, 0);
  return used >= budget;
}

/** Client IP as seen by Supabase's edge (first X-Forwarded-For hop). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (req.headers.get("cf-connecting-ip") ?? forwarded ?? "unknown").slice(0, 64);
}

/** "0157 7180 7377" -> "%7%1%8%0%7%3%7%7%" pattern over the last 9 digits (matches any formatting). */
export function phoneTailPattern(phone: string | null | undefined, digits = 9): string | null {
  const tail = (phone ?? "").replace(/\D/g, "").slice(-digits);
  return tail.length === digits ? `%${tail.split("").join("%")}%` : null;
}

/** Removes line breaks and quotes from customer-controlled text before it goes into the system prompt. */
export function promptSafe(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/[\r\n\t"`]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}
