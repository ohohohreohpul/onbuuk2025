import { supabase } from '../../../lib/supabase';

export type OrderStatus = 'pending_payment' | 'paid' | 'cancelled';

export interface OrderCard {
  id: string;
  code: string;
  card_type: 'value' | 'service_pass';
  original_value_cents: number;
  service_pass_name: string | null;
  original_visits: number | null;
  expires_at: string | null;
  status: string;
  service_durations: { duration_minutes: number } | null;
}

export interface GiftCardOrder {
  id: string;
  order_number: string;
  title: string;
  total_cents: number;
  status: OrderStatus;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  recipient_email: string | null;
  message: string | null;
  bonus_note: string | null;
  bonus_handed_at: string | null;
  paid_at: string | null;
  created_at: string;
  gift_card_packages: { cover_url: string | null } | null;
  gift_cards: OrderCard[];
}

export interface PackageSummary {
  id: string;
  name: string;
  price_cents: number;
  is_active: boolean;
  sold_count: number;
  stock_limit: number | null;
  valid_from: string | null;
  valid_until: string | null;
}

const ORDER_LIMIT = 200;

const firstOrSelf = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function loadOrders(businessId: string): Promise<GiftCardOrder[]> {
  const { data, error } = await supabase
    .from('gift_card_orders')
    .select('*, gift_card_packages(cover_url), gift_cards(id, code, card_type, original_value_cents, service_pass_name, original_visits, expires_at, status, service_durations(duration_minutes))')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(ORDER_LIMIT);
  if (error) throw error;
  return (data ?? []).map((order) => ({
    ...order,
    gift_card_packages: firstOrSelf(order.gift_card_packages),
    gift_cards: (order.gift_cards ?? []).map((card: OrderCard & { service_durations: unknown }) => ({
      ...card,
      service_durations: firstOrSelf(card.service_durations as OrderCard['service_durations'] | OrderCard['service_durations'][]),
    })),
  })) as GiftCardOrder[];
}

export async function loadPackages(businessId: string): Promise<PackageSummary[]> {
  const { data, error } = await supabase
    .from('gift_card_packages')
    .select('id, name, price_cents, is_active, sold_count, stock_limit, valid_from, valid_until')
    .eq('business_id', businessId)
    .order('display_order');
  if (error) throw error;
  return (data ?? []) as PackageSummary[];
}

export async function setPackageActive(packageId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('gift_card_packages')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', packageId);
  if (error) throw error;
}

export async function markOrderPaid(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_gift_card_order_paid', { p_order_id: orderId });
  if (error) throw error;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_gift_card_order', { p_order_id: orderId });
  if (error) throw error;
}

export async function setBonusHanded(orderId: string, isHanded: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_gift_card_order_bonus_handed', { p_order_id: orderId, p_handed: isHanded });
  if (error) throw error;
}
