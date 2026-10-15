/**
 * Deep links into the voucher page, used by promotion emails:
 *   /?gutschein=1            opens the voucher page
 *   /?gutschein=1&karte=<id> opens it with that multi-visit card selected
 *   /?gutschein=1&set=<id>   opens it with that voucher set selected
 * Keep in sync with GIFT_LINK_PARAMS in supabase/functions/_shared/marketingData.ts.
 */
export interface GiftCardLink {
  open: boolean;
  passId: string | null;
  setId: string | null;
}

export function readGiftCardLink(search: string): GiftCardLink {
  const params = new URLSearchParams(search);
  const passId = params.get('karte');
  const setId = params.get('set');
  return { open: params.has('gutschein') || Boolean(passId || setId), passId, setId };
}
