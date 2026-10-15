import { describe, expect, it } from 'vitest';
import { openAmountCents, totalsByMethod, type BookingPayment } from '../../components/admin/bookings/paymentMethods';

const payment = (method: BookingPayment['method'], amount_cents: number, gift_card_id: string | null = null): BookingPayment => ({
  id: `${method}-${amount_cents}`,
  booking_id: 'b1',
  method,
  amount_cents,
  gift_card_id,
  reference: null,
  created_at: '2026-10-15T10:00:00Z',
});

describe('openAmountCents', () => {
  it('subtracts counter payments from the price after vouchers', () => {
    expect(openAmountCents(4500, [payment('cash', 1500)])).toBe(3000);
  });

  it('ignores Zenno voucher redemptions because they already reduced the price', () => {
    expect(openAmountCents(1500, [payment('gift_card', 3000, 'card-1')])).toBe(1500);
  });

  it('counts a paper voucher noted at the counter like cash', () => {
    expect(openAmountCents(4500, [payment('gift_card', 3000), payment('cash', 1500)])).toBe(0);
  });

  it('never goes below zero', () => {
    expect(openAmountCents(1000, [payment('cash', 2000)])).toBe(0);
  });
});

describe('totalsByMethod', () => {
  it('sums per method and leaves out unused methods', () => {
    const totals = totalsByMethod([payment('cash', 1000), payment('gift_card', 3000), payment('cash', 500)]);
    expect(totals).toEqual([
      { method: 'cash', cents: 1500, count: 2 },
      { method: 'gift_card', cents: 3000, count: 1 },
    ]);
  });
});
