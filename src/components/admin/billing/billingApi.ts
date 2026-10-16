import { supabase } from '../../../lib/supabase';
import { adminAccessToken } from '../../../lib/functionAuth';

export type PlanKey = 'free' | 'pro' | 'custom';
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

async function callBillingFunction(name: string, body: Record<string, unknown>): Promise<string> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await adminAccessToken()}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || 'Checkout could not be started.');
  return data.url as string;
}

export const startUpgrade = (couponCode: string) => callBillingFunction('upgrade-subscription', { coupon_code: couponCode });
export const buyPack = (pack: PackKey) => callBillingFunction('buy-ai-credits', { pack });
export const openBillingPortal = (businessId: string) => callBillingFunction('create-portal-session', { business_id: businessId });

/** Replies still available this month (allowance left + purchased). */
export function repliesLeft(overview: BillingOverview): number {
  return Math.max(0, overview.allowance - overview.used) + overview.purchased;
}
