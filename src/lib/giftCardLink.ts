/**
 * Deep links into the voucher page, used by promotion emails:
 *   /?gutschein=1            opens the voucher page
 *   /?gutschein=1&karte=<id> opens it with that multi-visit card selected
 *   /?gutschein=1&set=<id>   opens it with that voucher set selected
 *   /?gutschein=1&kasse=<id> opens it with an order agreed in the website chat, ready to pay
 * Keep in sync with GIFT_LINK_PARAMS in supabase/functions/_shared/marketingData.ts.
 */
export interface GiftCardLink {
  open: boolean;
  passId: string | null;
  setId: string | null;
  /** Checkout draft from the website chat (gift_card_checkout_drafts.id). */
  checkoutId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readGiftCardLink(search: string): GiftCardLink {
  const params = new URLSearchParams(search);
  const passId = params.get('karte');
  const setId = params.get('set');
  const checkout = params.get('kasse');
  const checkoutId = checkout && UUID.test(checkout) ? checkout : null;
  return { open: params.has('gutschein') || Boolean(passId || setId || checkoutId), passId, setId, checkoutId };
}
