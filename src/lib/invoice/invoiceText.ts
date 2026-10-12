/**
 * The words on a German invoice (§14 UStG), separate from the PDF drawing so
 * they can be tested: number, invoice + service date, seller tax number, lines,
 * net / VAT / gross, Kleinunternehmer note, voucher payment.
 */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_gross_cents: number;
  vat_bps: number;
}

export interface InvoiceSeller {
  name: string;
  address: string | null;
  phone: string | null;
  tax_number: string | null;
  vat_id: string | null;
  footer: string | null;
}

export interface Invoice {
  invoice_number: string;
  issued_at: string;
  service_date: string | null;
  seller: InvoiceSeller;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  items: InvoiceItem[];
  vat_bps: number;
  is_small_business: boolean;
  net_cents: number;
  vat_cents: number;
  gross_cents: number;
  paid_with_voucher_cents: number;
  currency: string;
}

export interface InvoiceText {
  title: string;
  meta: string[];
  seller: string[];
  sellerTax: string | null;
  customer: string[];
  lines: { description: string; quantity: string; unit: string; total: string }[];
  totals: [string, string][];
  notes: string[];
  footer: string | null;
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100).replace(/\u00a0/g, ' ');

const germanDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
};

export function invoiceText(invoice: Invoice): InvoiceText {
  const format = (cents: number) => money(cents, invoice.currency || 'EUR');
  const seller = invoice.seller;
  const sellerTax = seller.vat_id
    ? `USt-IdNr.: ${seller.vat_id}`
    : seller.tax_number ? `Steuernummer: ${seller.tax_number}` : null;

  const totals: [string, string][] = invoice.is_small_business || invoice.vat_bps === 0
    ? [['Gesamtbetrag', format(invoice.gross_cents)]]
    : [
        ['Nettobetrag', format(invoice.net_cents)],
        [`zzgl. ${invoice.vat_bps / 100} % USt.`, format(invoice.vat_cents)],
        ['Gesamtbetrag', format(invoice.gross_cents)],
      ];

  const notes: string[] = [];
  if (invoice.is_small_business) notes.push('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
  if (invoice.paid_with_voucher_cents > 0) notes.push(`Davon mit Gutschein bezahlt: ${format(invoice.paid_with_voucher_cents)}`);

  return {
    title: `Rechnung Nr. ${invoice.invoice_number}`,
    meta: [
      `Rechnungsdatum: ${germanDate(invoice.issued_at)}`,
      ...(invoice.service_date ? [`Leistungsdatum: ${germanDate(invoice.service_date)}`] : []),
    ],
    seller: [seller.name, seller.address, seller.phone].filter((line): line is string => Boolean(line)),
    sellerTax,
    customer: [invoice.customer_name, invoice.customer_address].filter((line): line is string => Boolean(line)),
    lines: invoice.items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unit: format(item.unit_gross_cents),
      total: format(item.unit_gross_cents * item.quantity),
    })),
    totals,
    notes,
    footer: seller.footer,
  };
}
