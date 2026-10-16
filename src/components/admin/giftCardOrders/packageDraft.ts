import type { PackageDraft, PackageItemDraft } from './giftCardOrdersApi';

/** "70", "70,5", "1.234,50" -> cents; null when empty or invalid. */
export function euroToCents(input: string): number | null {
  const clean = input.trim().replace(/\s|€/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToEuro(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

/** A date input (YYYY-MM-DD, local) -> start of that day; for "until", the start of the next day (exclusive end). */
export function dayToIso(day: string, isEnd: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + (isEnd ? 1 : 0)).toISOString();
}

export function isoToDay(iso: string | null, isEnd: boolean): string {
  if (!iso) return '';
  const date = new Date(new Date(iso).getTime() - (isEnd ? 1 : 0));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type DraftProblem = 'needName' | 'needPrice' | 'needItems' | 'badItem' | 'badDates';

function isItemComplete(item: PackageItemDraft): boolean {
  if (item.quantity < 1 || item.quantity > 50) return false;
  return item.kind === 'service_pass' ? Boolean(item.service_id && item.duration_id) : (item.value_cents ?? 0) > 0;
}

export function findProblem(draft: PackageDraft): DraftProblem | null {
  if (!draft.name.trim()) return 'needName';
  if (!(draft.price_cents > 0)) return 'needPrice';
  if (draft.items.length === 0) return 'needItems';
  if (!draft.items.every(isItemComplete)) return 'badItem';
  if (draft.valid_from && draft.valid_until && draft.valid_until <= draft.valid_from) return 'badDates';
  return null;
}

/** Clears the fields that do not belong to the item's kind, as the database expects. */
export function cleanItems(items: PackageItemDraft[]): PackageItemDraft[] {
  return items.map((item) => item.kind === 'service_pass'
    ? { ...item, value_cents: null }
    : { ...item, service_id: null, duration_id: null });
}
