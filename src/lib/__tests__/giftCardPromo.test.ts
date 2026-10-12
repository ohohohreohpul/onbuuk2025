import { describe, expect, it } from 'vitest';
import { promoFormFromSettings, promoPayloadFromForm, type PromoForm } from '../giftCardPromo';

const FORM: PromoForm = {
  payInStoreEnabled: true,
  title: ' Exklusive Gutscheinsets ',
  text: 'Zu jedem Gutscheinkauf ab 70 € erhalten Sie eine Überraschung.',
  giftNote: 'Kleine Überraschung von uns',
  giftMinEuros: '70',
  giftMinMinutes: '60',
  validFrom: '2026-10-07',
  validUntil: '2026-12-23',
};

describe('promoPayloadFromForm', () => {
  it('turns the form into the stored columns', () => {
    const result = promoPayloadFromForm(FORM);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({
      pay_in_store_enabled: true,
      promo_title: 'Exklusive Gutscheinsets',
      promo_gift_note: 'Kleine Überraschung von uns',
      promo_gift_min_cents: 7000,
      promo_gift_min_minutes: 60,
    });
    expect(new Date(result.payload.promo_valid_from as string).getDate()).toBe(7);
    // "until" includes the whole last day
    const until = new Date(result.payload.promo_valid_until as string);
    expect([until.getDate(), until.getHours(), until.getMinutes()]).toEqual([23, 23, 59]);
  });

  it('stores empty fields as null so the banner disappears', () => {
    const result = promoPayloadFromForm({ ...FORM, title: '', text: ' ', giftNote: '', giftMinEuros: '', giftMinMinutes: '', validFrom: '', validUntil: '' });

    expect(result).toEqual({
      ok: true,
      payload: {
        pay_in_store_enabled: true,
        promo_title: null,
        promo_text: null,
        promo_gift_note: null,
        promo_gift_min_cents: null,
        promo_gift_min_minutes: null,
        promo_valid_from: null,
        promo_valid_until: null,
      },
    });
  });

  it('rejects an end date before the start date', () => {
    expect(promoPayloadFromForm({ ...FORM, validFrom: '2026-12-24', validUntil: '2026-12-23' }))
      .toEqual({ ok: false, error: 'The promotion must end after it starts.' });
  });

  it('rejects negative or non-numeric minimums', () => {
    expect(promoPayloadFromForm({ ...FORM, giftMinEuros: '-5' }).ok).toBe(false);
    expect(promoPayloadFromForm({ ...FORM, giftMinMinutes: 'abc' }).ok).toBe(false);
  });
});

describe('promoFormFromSettings', () => {
  it('shows stored values as form text', () => {
    const form = promoFormFromSettings({
      pay_in_store_enabled: true,
      promo_title: 'T',
      promo_text: null,
      promo_gift_note: 'G',
      promo_gift_min_cents: 7000,
      promo_gift_min_minutes: null,
      promo_valid_from: new Date(2026, 9, 7, 0, 0).toISOString(),
      promo_valid_until: null,
    });

    expect(form).toEqual({
      payInStoreEnabled: true, title: 'T', text: '', giftNote: 'G', giftMinEuros: '70', giftMinMinutes: '',
      validFrom: '2026-10-07', validUntil: '',
    });
  });
});
