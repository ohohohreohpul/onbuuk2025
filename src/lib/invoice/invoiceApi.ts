import { supabase } from '../supabase';
import { invoicePdf, type InvoiceFonts } from './invoicePdf';
import { invoiceText, type Invoice, type InvoiceBuyer } from './invoiceText';
import { embedZugferd } from './zugferdPdf';
import { zugferdXml } from './zugferdXml';
import regularFontUrl from '../../assets/fonts/LiberationSans-Regular.ttf?url';
import boldFontUrl from '../../assets/fonts/LiberationSans-Bold.ttf?url';

/** What the shop typed for a company customer; the database cleans and checks it. */
export type InvoiceBuyerInput = Partial<Omit<InvoiceBuyer, 'company'>> & { company: string };

let fontsPromise: Promise<InvoiceFonts> | null = null;

async function fontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Loaded once, only when the first invoice is printed (≈ 800 KB). */
function invoiceFonts(): Promise<InvoiceFonts> {
  fontsPromise ??= Promise.all([fontAsBase64(regularFontUrl), fontAsBase64(boldFontUrl)])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error) => {
      fontsPromise = null;
      throw error;
    });
  return fontsPromise;
}

/** The invoice as ZUGFeRD PDF (EN 16931): readable PDF with the e-invoice XML inside. */
export async function zugferdInvoicePdf(invoice: Invoice): Promise<Blob> {
  const drawn = invoicePdf(invoice, await invoiceFonts());
  const bytes = await embedZugferd(new Uint8Array(drawn), zugferdXml(invoice), {
    title: invoiceText(invoice).title,
    issuedAt: new Date(invoice.issued_at),
  });
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * Issues the booking's invoice, or returns the existing one (one number per
 * booking; a second call ignores the new customer data).
 */
export async function issueBookingInvoice(
  bookingId: string,
  options: { customerAddress?: string; buyer?: InvoiceBuyerInput } = {},
): Promise<Invoice> {
  const { data, error } = await supabase.rpc('issue_booking_invoice', {
    p_booking_id: bookingId,
    p_customer_address: options.customerAddress ?? null,
    p_buyer: options.buyer ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Invoice;
}

/** Downloads an issued invoice as "<number>.pdf". */
export async function saveInvoicePdf(invoice: Invoice): Promise<void> {
  const url = URL.createObjectURL(await zugferdInvoicePdf(invoice));
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
}

/** The booking's invoice if one was issued already (it can only be reprinted, never changed). */
export async function findBookingInvoice(bookingId: string): Promise<Invoice | null> {
  const { data, error } = await supabase.from('invoices').select('*').eq('booking_id', bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Invoice | null;
}
