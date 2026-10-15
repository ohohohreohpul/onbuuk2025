import { openAmountCents, type BookingPayment } from './paymentMethods';

/** The fields the three-step row (confirm → showed up → paid) needs. */
export interface StepBooking {
  booking_date: string;
  status: string;
  payment_status: string | null;
  final_amount_cents: number | null;
  duration: { price_cents: number } | null;
  payments: BookingPayment[] | null;
}

/** Amount still to pay; a booking marked paid owes nothing. */
export const openCentsOf = (b: StepBooking): number =>
  b.payment_status === 'completed' ? 0 : openAmountCents(b.final_amount_cents ?? b.duration?.price_cents ?? 0, b.payments ?? []);

/**
 * Which step a booking is at: 1 confirm, 2 showed up (from its day on), 3 payment.
 * 'wait' = confirmed but its day has not come; 'done' = completed and paid.
 */
export function stepOf(b: StepBooking, today: string): 1 | 2 | 3 | 'done' | 'wait' {
  if (b.status === 'pending') return 1;
  if (b.status === 'confirmed') return b.booking_date <= today ? 2 : 'wait';
  if (b.status === 'completed') return openCentsOf(b) > 0 ? 3 : 'done';
  return 'done';
}
