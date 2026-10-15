interface SearchableGiftCard {
  code: string;
  purchased_by_name?: string | null;
  purchased_by_email?: string | null;
  purchased_for_email?: string | null;
  service_pass_name?: string | null;
}

const compactCode = (value: string) => value.toLowerCase().replace(/[\s-]/g, '');

/** Search the gift card table by code (dashes/spaces ignored), buyer, recipient or product. */
export function filterGiftCards<T extends SearchableGiftCard>(cards: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return cards;
  const codeNeedle = compactCode(needle);
  return cards.filter((card) => {
    if (codeNeedle && compactCode(card.code).includes(codeNeedle)) return true;
    return [card.purchased_by_name, card.purchased_by_email, card.purchased_for_email, card.service_pass_name]
      .some((field) => field?.toLowerCase().includes(needle));
  });
}
