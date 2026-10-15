import type { Translations } from '../../../lib/bookingLanguage';

/** booking_payments.method values (see migration 20261015090000_booking_payments.sql). */
export type PaymentMethod = 'cash' | 'card' | 'gift_card' | 'service_pass' | 'stripe' | 'paypal' | 'other';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'gift_card', 'service_pass', 'stripe', 'paypal', 'other'];

export interface BookingPayment {
  id: string;
  booking_id: string;
  method: PaymentMethod;
  amount_cents: number;
  gift_card_id?: string | null;
  reference: string | null;
  created_at: string;
}

export const PAYMENT_METHOD_LABELS: Translations<Record<PaymentMethod, string>> = {
  en: {
    cash: 'Cash', card: 'Card (terminal)', gift_card: 'Gift card', service_pass: 'Service pass',
    stripe: 'Online (Stripe)', paypal: 'PayPal', other: 'Other',
  },
  de: {
    cash: 'Bar', card: 'Karte (Terminal)', gift_card: 'Gutschein', service_pass: 'Mehrfachkarte',
    stripe: 'Online (Stripe)', paypal: 'PayPal', other: 'Sonstiges',
  },
  th: {
    cash: 'เงินสด', card: 'บัตร (เครื่องรูดบัตร)', gift_card: 'บัตรของขวัญ', service_pass: 'บัตรแพ็กเกจ',
    stripe: 'ออนไลน์ (Stripe)', paypal: 'PayPal', other: 'อื่น ๆ',
  },
};

/**
 * Payments staff record by hand, including vouchers noted without a Zenno code.
 * Vouchers redeemed through Zenno (gift_card_id set) reduce the price instead.
 */
export const isCounterPayment = (payment: Pick<BookingPayment, 'method' | 'gift_card_id'>): boolean =>
  payment.method === 'cash' || payment.method === 'card' || payment.method === 'other'
  || (payment.method === 'gift_card' && !payment.gift_card_id);

/** Amount still open: the price after vouchers minus what was paid at the counter. */
export function openAmountCents(finalAmountCents: number, payments: BookingPayment[]): number {
  const paidAtCounter = payments
    .filter(isCounterPayment)
    .reduce((sum, payment) => sum + payment.amount_cents, 0);
  return Math.max(0, finalAmountCents - paidAtCounter);
}

/** Sum per method, in PAYMENT_METHODS order, leaving out methods with nothing paid. */
export function totalsByMethod(payments: BookingPayment[]): { method: PaymentMethod; cents: number; count: number }[] {
  return PAYMENT_METHODS
    .map((method) => {
      const rows = payments.filter((payment) => payment.method === method);
      return { method, cents: rows.reduce((sum, row) => sum + row.amount_cents, 0), count: rows.length };
    })
    .filter((total) => total.count > 0);
}
