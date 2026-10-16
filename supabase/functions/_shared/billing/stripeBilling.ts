// Zenno's own billing (the shop pays Zenno): the 49 € plan and AI reply packs.
// Prices: plan from STRIPE_ZENNO_MONTHLY_PRICE_ID; packs as fixed amounts below.

import Stripe from "npm:stripe@17.7.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

export const AI_PACKS = {
  small: { replies: 500, amountCents: 1000 },
  medium: { replies: 2000, amountCents: 2900 },
  large: { replies: 10000, amountCents: 9900 },
} as const;
export type AiPack = keyof typeof AI_PACKS;

export function isAiPack(value: unknown): value is AiPack {
  return typeof value === "string" && Object.hasOwn(AI_PACKS, value);
}

export function stripeClient(): Stripe {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { appInfo: { name: "Zenno", version: "1.0.0" } });
}

/** Only our own app origins may be used for redirect URLs. */
export function returnBase(req: Request): string {
  const origin = req.headers.get("origin") ?? "";
  const allowed = /^https:\/\/(book\.zennohq\.(com|studio)|app\.onbuuk\.com|[a-z0-9-]+\.zennohq\.(com|studio))$/i.test(origin)
    || /^http:\/\/localhost:\d+$/.test(origin);
  return allowed ? origin : "https://book.zennohq.com";
}

/** The shop's Stripe customer for paying Zenno (created once, stored on the business). */
export async function shopCustomer(supabase: SupabaseClient, stripe: Stripe, businessId: string): Promise<string> {
  const { data: business, error } = await supabase.from("businesses").select("id, name, stripe_customer_id").eq("id", businessId).single();
  if (error || !business) throw new Error("Business not found");
  if (business.stripe_customer_id) return business.stripe_customer_id;
  const { data: owner } = await supabase.from("admin_users").select("email").eq("business_id", businessId)
    .in("role", ["owner", "admin"]).order("role", { ascending: true }).limit(1).maybeSingle();
  const customer = await stripe.customers.create({
    email: owner?.email ?? undefined, name: business.name, metadata: { business_id: business.id },
  });
  await supabase.from("businesses").update({ stripe_customer_id: customer.id }).eq("id", businessId);
  return customer.id;
}
