/**
 * Voucher promotion of a shop (gift_card_settings.promo_*): banner on the voucher
 * page, gift note on qualifying orders, and the "pay in the shop" switch.
 */
import { toLocalDateString } from './localDateTime';

export interface PromoSettingsRow {
  pay_in_store_enabled: boolean;
  promo_title: string | null;
  promo_text: string | null;
  promo_gift_note: string | null;
  promo_gift_min_cents: number | null;
  promo_gift_min_minutes: number | null;
  promo_valid_from: string | null;
  promo_valid_until: string | null;
}

/** Form values as typed (strings), dates as YYYY-MM-DD in local time. */
export interface PromoForm {
  payInStoreEnabled: boolean;
  title: string;
  text: string;
  giftNote: string;
  giftMinEuros: string;
  giftMinMinutes: string;
  validFrom: string;
  validUntil: string;
}

export type PromoResult = { ok: true; payload: PromoSettingsRow } | { ok: false; error: string };

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

function parseNonNegative(value: string): number | null | 'invalid' {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && number >= 0 ? number : 'invalid';
}

/** Start of the given local day / end of it (23:59:59), as ISO instants. */
function localDayBoundary(day: string, isEnd: boolean): string | null {
  if (!day) return null;
  const [year, month, date] = day.split('-').map(Number);
  const local = isEnd ? new Date(year, month - 1, date, 23, 59, 59) : new Date(year, month - 1, date, 0, 0, 0);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

export function promoPayloadFromForm(form: PromoForm): PromoResult {
  const euros = parseNonNegative(form.giftMinEuros);
  const minutes = parseNonNegative(form.giftMinMinutes);
  if (euros === 'invalid' || minutes === 'invalid') {
    return { ok: false, error: 'Minimum amount and minutes must be positive numbers.' };
  }
  const validFrom = localDayBoundary(form.validFrom, false);
  const validUntil = localDayBoundary(form.validUntil, true);
  if (validFrom && validUntil && validUntil <= validFrom) {
    return { ok: false, error: 'The promotion must end after it starts.' };
  }
  return {
    ok: true,
    payload: {
      pay_in_store_enabled: form.payInStoreEnabled,
      promo_title: blankToNull(form.title),
      promo_text: blankToNull(form.text),
      promo_gift_note: blankToNull(form.giftNote),
      promo_gift_min_cents: euros === null ? null : Math.round(euros * 100),
      promo_gift_min_minutes: minutes === null ? null : Math.round(minutes),
      promo_valid_from: validFrom,
      promo_valid_until: validUntil,
    },
  };
}

export function promoFormFromSettings(row: Partial<PromoSettingsRow> | null): PromoForm {
  const day = (iso: string | null | undefined) => (iso ? toLocalDateString(new Date(iso)) : '');
  return {
    payInStoreEnabled: Boolean(row?.pay_in_store_enabled),
    title: row?.promo_title ?? '',
    text: row?.promo_text ?? '',
    giftNote: row?.promo_gift_note ?? '',
    giftMinEuros: row?.promo_gift_min_cents != null ? String(row.promo_gift_min_cents / 100) : '',
    giftMinMinutes: row?.promo_gift_min_minutes != null ? String(row.promo_gift_min_minutes) : '',
    validFrom: day(row?.promo_valid_from),
    validUntil: day(row?.promo_valid_until),
  };
}
