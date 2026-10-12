import { supabase } from '../supabase';
import { invoicePdf } from './invoicePdf';
import type { Invoice } from './invoiceText';

/**
 * Issues the booking's invoice (or returns the existing one - one number per
 * booking) and downloads it as PDF.
 */
export async function downloadBookingInvoice(bookingId: string, customerAddress?: string): Promise<Invoice> {
  const { data, error } = await supabase.rpc('issue_booking_invoice', {
    p_booking_id: bookingId,
    p_customer_address: customerAddress ?? null,
  });
  if (error) throw new Error(error.message);
  const invoice = data as Invoice;

  const url = URL.createObjectURL(invoicePdf(invoice));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoice_number}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return invoice;
}
