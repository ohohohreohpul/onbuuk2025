import { supabase } from './supabase';
import { cachedRequest } from './requestCache';
import { loadBookingCustomization } from '../hooks/useBookingCustomization';

/** Shop fields the public booking page needs (header, badge, welcome page). */
export interface ShopPageProfile {
  name: string | null;
  tagline: string | null;
  plan_type: string | null;
  hide_powered_by_badge: boolean | null;
  enable_bookings: boolean | null;
  enable_gift_cards: boolean | null;
  show_welcome_features: boolean | null;
  use_custom_welcome_html: boolean | null;
  welcome_custom_html: string | null;
}

const PROFILE_COLUMNS = 'name, tagline, plan_type, hide_powered_by_badge, enable_bookings, enable_gift_cards, '
  + 'show_welcome_features, use_custom_welcome_html, welcome_custom_html';

export function loadShopPageProfile(businessId: string): Promise<ShopPageProfile | null> {
  return cachedRequest(`shop_page_profile:${businessId}`, async () => {
    const { data, error } = await supabase.from('businesses').select(PROFILE_COLUMNS).eq('id', businessId).maybeSingle();
    if (error) throw error;
    return data as ShopPageProfile | null;
  });
}

export function loadWelcomeCards<T>(businessId: string): Promise<T[]> {
  return cachedRequest(`welcome_cards:${businessId}`, async () => {
    const { data, error } = await supabase
      .from('welcome_feature_cards')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_enabled', true)
      .order('card_order');
    if (error) throw error;
    return (data ?? []) as T[];
  });
}

/** Starts the first page's requests together instead of one after another. */
export function prefetchShopPage(businessId: string): void {
  const report = (error: unknown) => console.error('Could not preload the booking page:', error);
  loadBookingCustomization(businessId).catch(report);
  loadShopPageProfile(businessId).catch(report);
  loadWelcomeCards(businessId).catch(report);
}
