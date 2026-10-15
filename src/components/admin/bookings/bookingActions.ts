import { supabase } from '../../../lib/supabase';

/**
 * Booking status changes shared by the bookings list and the dashboard, so both
 * behave the same. Confirmation / cancellation emails are queued by the database
 * when the status changes.
 */
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export async function setBookingStatus(bookingId: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId);
  if (error) throw error;
}

export interface NoShowBooking {
  id: string;
  business_id?: string;
  customer_email: string;
  booking_date: string;
  start_time: string;
  service: { name: string; no_show_fee: number } | null;
}

/** Result of marking a no-show: whether a card on file was charged, and how much. */
export interface NoShowResult {
  chargedAmount: number | null;
}

/**
 * Marks the booking as no-show (cancelled) and handles the no-show fee: charge the
 * card on file if there is one (Treatwell model), otherwise record an unpaid fee.
 */
export async function markBookingNoShow(businessId: string, booking: NoShowBooking, feeNote: string): Promise<NoShowResult> {
  const { error } = await supabase
    .from('bookings')
    .update({ no_show: true, no_show_marked_at: new Date().toISOString(), status: 'cancelled' })
    .eq('id', booking.id);
  if (error) throw error;

  const fee = booking.service?.no_show_fee ?? 0;
  if (fee <= 0) return { chargedAmount: null };

  try {
    const { data: charge, error: chargeError } = await supabase.functions.invoke('charge-no-show-fee', { body: { booking_id: booking.id } });
    if (!chargeError && charge?.charged) return { chargedAmount: Number(charge.amount) };
  } catch (chargeError) {
    console.error('Card charge attempt failed:', chargeError);
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', booking.customer_email)
    .eq('business_id', businessId)
    .maybeSingle();
  const { error: feeError } = await supabase.from('no_show_fees').insert({
    booking_id: booking.id,
    customer_id: customer?.id || null,
    amount: fee,
    reason: 'no_show',
    notes: feeNote,
  });
  if (feeError) console.error('Failed to create no-show fee:', feeError);
  return { chargedAmount: null };
}
