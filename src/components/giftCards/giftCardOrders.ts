import { supabase } from '../../lib/supabase';

export interface PackageItem {
  id: string;
  kind: 'service_pass' | 'value';
  quantity: number;
  value_cents: number | null;
  label: string | null;
  display_order: number;
  services?: { name: string } | null;
  service_durations?: { duration_minutes: number; price_cents: number } | null;
}

export interface GiftCardPackage {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  bonus_note: string | null;
  cover_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  stock_limit: number | null;
  sold_count: number;
  gift_card_package_items: PackageItem[];
}

export interface PromoSettings {
  promo_title?: string | null;
  promo_text?: string | null;
  promo_valid_from?: string | null;
  promo_valid_until?: string | null;
}

export interface PlacedOrder {
  order_id: string;
  order_number: string;
  title: string;
  total_cents: number;
  bonus_note: string | null;
}

export interface OrderInput {
  businessId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  recipientEmail?: string;
  message?: string;
  packageId?: string;
  servicePassOfferId?: string;
  valueCents?: number;
}

const firstOrSelf = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export function isWithinWindow(from: string | null | undefined, until: string | null | undefined, now = new Date()): boolean {
  if (from && now < new Date(from)) return false;
  if (until && now >= new Date(until)) return false;
  return true;
}

export const isSoldOut = (pkg: GiftCardPackage): boolean =>
  pkg.stock_limit !== null && pkg.sold_count >= pkg.stock_limit;

/** Packages on sale right now, best first. */
export async function loadActivePackages(businessId: string): Promise<GiftCardPackage[]> {
  const { data, error } = await supabase
    .from('gift_card_packages')
    .select('id, name, subtitle, description, price_cents, compare_at_cents, bonus_note, cover_url, valid_from, valid_until, stock_limit, sold_count, gift_card_package_items(id, kind, quantity, value_cents, label, display_order, services(name), service_durations(duration_minutes, price_cents))')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('display_order');
  // The table may not exist yet on older databases; the page then simply shows no packages.
  if (error) {
    console.error('Could not load gift card packages:', error.message);
    return [];
  }
  return (data ?? [])
    .map((pkg) => ({
      ...pkg,
      gift_card_package_items: [...(pkg.gift_card_package_items ?? [])]
        .map((item) => ({
          ...item,
          services: firstOrSelf(item.services),
          service_durations: firstOrSelf(item.service_durations),
        }))
        .sort((a, b) => a.display_order - b.display_order),
    }) as GiftCardPackage)
    .filter((pkg) => isWithinWindow(pkg.valid_from, pkg.valid_until));
}

/** Sum of the single prices, to show "statt …" when no compare price is set. */
export const packageStandardValue = (pkg: GiftCardPackage): number =>
  pkg.gift_card_package_items.reduce(
    (sum, item) => sum + item.quantity * (item.kind === 'value' ? item.value_cents ?? 0 : item.service_durations?.price_cents ?? 0),
    0,
  );

export async function placeGiftCardOrder(input: OrderInput): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc('place_gift_card_order', {
    p_business_id: input.businessId,
    p_buyer_name: input.buyerName,
    p_buyer_email: input.buyerEmail,
    p_package_id: input.packageId ?? null,
    p_service_pass_offer_id: input.servicePassOfferId ?? null,
    p_value_cents: input.valueCents ?? null,
    p_buyer_phone: input.buyerPhone || null,
    p_recipient_name: null,
    p_recipient_email: input.recipientEmail || null,
    p_message: input.message || null,
  });
  if (error) throw error;
  return data as PlacedOrder;
}

export type OrderErrorKind = 'sold_out' | 'unavailable' | 'limit' | 'invalid' | 'unknown';

export function orderErrorKind(error: unknown): OrderErrorKind {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? '');
  if (message.includes('ORDER_SOLD_OUT')) return 'sold_out';
  if (message.includes('ORDER_UNAVAILABLE')) return 'unavailable';
  if (message.includes('ORDER_LIMIT')) return 'limit';
  if (message.includes('ORDER_INVALID')) return 'invalid';
  return 'unknown';
}
