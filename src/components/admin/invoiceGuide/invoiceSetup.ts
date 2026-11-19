import { parsePostalAddress, type PostalAddress } from '../../../lib/invoice/postalAddress';

/** Opens the invoice setup guide from anywhere (What's new, Settings › Invoices). Admin listens. */
export const INVOICE_GUIDE_EVENT = 'zenno:invoice-guide';

export function openInvoiceGuide(): void {
  window.dispatchEvent(new CustomEvent(INVOICE_GUIDE_EVENT));
}

export interface InvoiceSetupBusiness {
  name: string | null;
  legal_name: string | null;
  tax_number: string | null;
  vat_id: string | null;
  is_small_business: boolean | null;
  address: string | null;
  address_line: string | null;
  city: string | null;
}

export interface InvoiceSetupStatus {
  taxId: string | null;
  invoiceName: string | null;
  isSmallBusiness: boolean;
  address: PostalAddress;
  isAddressReadable: boolean;
}

const filled = (value: string | null | undefined) => value?.trim() || null;

/**
 * What an e-invoice would say about this shop. The address is read exactly as
 * issue_booking_invoice() snapshots it, so the check matches real invoices.
 */
export function invoiceSetupStatus(business: InvoiceSetupBusiness): InvoiceSetupStatus {
  const snapshotAddress = [business.address_line, business.city, business.address].map(filled).filter(Boolean).join(', ');
  const address = parsePostalAddress(snapshotAddress);
  return {
    taxId: filled(business.vat_id) ?? filled(business.tax_number),
    invoiceName: filled(business.legal_name) ?? filled(business.name),
    isSmallBusiness: Boolean(business.is_small_business),
    address,
    isAddressReadable: Boolean(address.street && address.postcode && address.city),
  };
}
