import { supabase } from './supabase';

export interface UnbilledNoShow {
  id: string;
  customer_email: string;
  booking_date: string;
  start_time: string;
  serviceName: string;
  feeCents: number;
}

/**
 * Create unpaid fee records for no-shows that were never billed.
 * Idempotent: the unique index on no_show_fees.booking_id means a booking
 * that already has a fee is left untouched.
 */
export async function createUnpaidNoShowFees(businessId: string, noShows: UnbilledNoShow[]): Promise<{ created: number; error: string | null }> {
  const billable = noShows.filter((booking) => booking.feeCents > 0);
  if (billable.length === 0) return { created: 0, error: null };

  const emails = [...new Set(billable.map((booking) => booking.customer_email).filter(Boolean))];
  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, email')
    .eq('business_id', businessId)
    .in('email', emails);

  if (customerError) {
    console.error('Could not look up customers for no-show fees:', customerError);
  }

  const customerIdByEmail = new Map((customers || []).map((customer) => [customer.email, customer.id]));
  const rows = billable.map((booking) => ({
    booking_id: booking.id,
    customer_id: customerIdByEmail.get(booking.customer_email) || null,
    amount: booking.feeCents,
    reason: 'no_show',
    notes: `No-show for ${booking.serviceName} on ${booking.booking_date} at ${booking.start_time.slice(0, 5)}`,
  }));

  const { error } = await supabase
    .from('no_show_fees')
    .upsert(rows, { onConflict: 'booking_id', ignoreDuplicates: true });

  if (error) {
    console.error('Could not create no-show fees:', error);
    return { created: 0, error: 'We could not add these fees. Please try again.' };
  }
  return { created: rows.length, error: null };
}
