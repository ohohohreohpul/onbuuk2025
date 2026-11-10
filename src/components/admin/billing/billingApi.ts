import { supabase } from '../../../lib/supabase';
import { adminAccessToken } from '../../../lib/functionAuth';

export type PlanKey = 'free' | 'pro' | 'social' | 'custom';
export type PaidPlan = 'pro' | 'social';
export type PackKey = 'small' | 'medium' | 'large';

export interface BillingOverview {
  plan: PlanKey;
  subscription_status: string | null;
  has_subscription: boolean;
  allowance: number;
  used: number;
  purchased: number;
}

/** Packs as sold (prices mirror supabase/functions/_shared/billing/stripeBilling.ts). */
export const PACKS: { key: PackKey; replies: number; priceCents: number }[] = [
  { key: 'small', replies: 500, priceCents: 1000 },
  { key: 'medium', replies: 2000, priceCents: 2900 },
  { key: 'large', replies: 10000, priceCents: 9900 },
];

export const PLAN_PRICE_CENTS = 4900;
export const SOCIAL_PRICE_CENTS = 6900;
export const PRICE_CENTS: Record<PaidPlan, number> = { pro: PLAN_PRICE_CENTS, social: SOCIAL_PRICE_CENTS };

/** Zenno bills in euros, whatever currency the shop sells in. */
export function euro(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
export const SUPPORT_EMAIL = 'support@zennohq.com';

export async function loadBillingOverview(): Promise<BillingOverview> {
  const { data, error } = await supabase.rpc('get_billing_overview');
  if (error) throw error;
  return data as BillingOverview;
}

async function postBillingFunction(name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await adminAccessToken()}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Checkout could not be started.');
  return data;
}

async function callBillingFunction(name: string, body: Record<string, unknown>): Promise<string> {
  const data = await postBillingFunction(name, body);
  if (!data.url) throw new Error('Checkout could not be started.');
  return data.url as string;
}

/** Checkout URL for a new subscription, or null when an existing one simply switched plan. */
export async function startUpgrade(couponCode: string, plan: PaidPlan = 'pro'): Promise<string | null> {
  const data = await postBillingFunction('upgrade-subscription', { coupon_code: couponCode, plan });
  if (data.switched) return null;
  if (!data.url) throw new Error('Checkout could not be started.');
  return data.url as string;
}
export const buyPack = (pack: PackKey) => callBillingFunction('buy-ai-credits', { pack });
export const openBillingPortal = (businessId: string) => callBillingFunction('create-portal-session', { business_id: businessId });

/** Replies still available this month (allowance left + purchased). */
export function repliesLeft(overview: BillingOverview): number {
  return Math.max(0, overview.allowance - overview.used) + overview.purchased;
}
