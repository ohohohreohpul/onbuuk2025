import { describe, expect, it } from 'vitest';
import { readGiftCardLink } from '../giftCardLink';

describe('readGiftCardLink', () => {
  it('opens the voucher page with a selected card', () => {
    expect(readGiftCardLink('?gutschein=1&karte=abc')).toEqual({ open: true, passId: 'abc', setId: null, checkoutId: null });
  });

  it('stays closed without the parameters', () => {
    expect(readGiftCardLink('?utm_source=x')).toEqual({ open: false, passId: null, setId: null, checkoutId: null });
  });

  it('opens a chat order by its id and ignores anything that is not an id', () => {
    const id = '5f1c2b9e-3a4d-4e6f-8a9b-0c1d2e3f4a5b';
    expect(readGiftCardLink(`?gutschein=1&kasse=${id}`).checkoutId).toBe(id);
    expect(readGiftCardLink('?kasse=not-an-id')).toEqual({ open: false, passId: null, setId: null, checkoutId: null });
  });
});
