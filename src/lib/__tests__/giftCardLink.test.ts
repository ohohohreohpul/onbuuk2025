import { describe, expect, it } from 'vitest';
import { readGiftCardLink } from '../giftCardLink';

describe('readGiftCardLink', () => {
  it('opens the voucher page with a selected card', () => {
    expect(readGiftCardLink('?gutschein=1&karte=abc')).toEqual({ open: true, passId: 'abc', setId: null });
  });

  it('stays closed without the parameters', () => {
    expect(readGiftCardLink('?utm_source=x')).toEqual({ open: false, passId: null, setId: null });
  });
});
