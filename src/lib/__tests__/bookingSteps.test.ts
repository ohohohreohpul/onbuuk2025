import { describe, expect, it } from 'vitest';
import { stepOf, type StepBooking } from '../../components/admin/bookings/bookingSteps';

const booking = (patch: Partial<StepBooking>): StepBooking => ({
  booking_date: '2026-10-15', status: 'pending', payment_status: 'pending',
  final_amount_cents: 7000, duration: { price_cents: 7000 }, payments: [], ...patch,
});
const TODAY = '2026-10-15';

describe('stepOf', () => {
  it('asks for confirmation first, even for future bookings', () => {
    expect(stepOf(booking({ booking_date: '2026-11-01' }), TODAY)).toBe(1);
  });

  it('asks "showed up?" from the booking day on, not before', () => {
    expect(stepOf(booking({ status: 'confirmed' }), TODAY)).toBe(2);
    expect(stepOf(booking({ status: 'confirmed', booking_date: '2026-10-16' }), TODAY)).toBe('wait');
  });

  it('asks for payment after the visit and drops off once paid', () => {
    expect(stepOf(booking({ status: 'completed' }), TODAY)).toBe(3);
    expect(stepOf(booking({ status: 'completed', payment_status: 'completed' }), TODAY)).toBe('done');
    const paidCash = booking({ status: 'completed', payments: [{ id: 'p', booking_id: 'b', method: 'cash', amount_cents: 7000, reference: null, created_at: '' }] });
    expect(stepOf(paidCash, TODAY)).toBe('done');
  });

  it('treats cancelled bookings as done', () => {
    expect(stepOf(booking({ status: 'cancelled' }), TODAY)).toBe('done');
  });
});
