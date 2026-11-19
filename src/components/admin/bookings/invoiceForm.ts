import type { InvoiceBuyerInput } from '../../../lib/invoice/invoiceApi';

/** Above this a German invoice needs the customer's address (Kleinbetragsrechnung, § 33 UStDV). */
export const SMALL_INVOICE_LIMIT_CENTS = 25000;

export interface InvoiceForm {
  kind: 'private' | 'company';
  address: string;
  company: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
  vatId: string;
  reference: string;
}

export const EMPTY_INVOICE_FORM: InvoiceForm = {
  kind: 'private', address: '', company: '', street: '', postcode: '', city: '', country: 'DE', vatId: '', reference: '',
};

export type InvoiceFormProblem = 'missingCompany' | 'missingAddress' | 'countryInvalid';

export function invoiceFormProblem(form: InvoiceForm, priceCents: number): InvoiceFormProblem | null {
  if (form.kind === 'private') {
    return priceCents > SMALL_INVOICE_LIMIT_CENTS && !form.address.trim() ? 'missingAddress' : null;
  }
  if (![form.company, form.street, form.postcode, form.city].every((value) => value.trim())) return 'missingCompany';
  if (!/^[A-Za-z]{2}$/.test(form.country.trim())) return 'countryInvalid';
  return null;
}

/** What goes to issue_booking_invoice(): an address for private customers, a buyer for companies. */
export function invoiceRequest(form: InvoiceForm): { customerAddress?: string; buyer?: InvoiceBuyerInput } {
  if (form.kind === 'private') return form.address.trim() ? { customerAddress: form.address.trim() } : {};
  const optional = (value: string) => value.trim() || undefined;
  return {
    buyer: {
      company: form.company.trim(),
      street: form.street.trim(),
      postcode: form.postcode.trim(),
      city: form.city.trim(),
      country: form.country.trim().toUpperCase(),
      vat_id: optional(form.vatId),
      reference: optional(form.reference),
    },
  };
}
