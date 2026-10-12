import { describe, expect, it } from 'vitest';
import { invoiceText, type Invoice } from '../invoiceText';

const INVOICE: Invoice = {
  invoice_number: 'RE-2026-0001',
  issued_at: '2026-11-04T10:00:00Z',
  service_date: '2026-11-04',
  seller: { name: 'SATUUU99 Wellness', address: 'Hagener Allee 1, 22926 Ahrensburg', phone: '04102 123', tax_number: '30/123/45678', vat_id: null, footer: 'IBAN DE00 0000' },
  customer_name: 'Anna Kunde',
  customer_email: 'anna@example.de',
  customer_address: null,
  items: [
    { description: 'Thai Massage (60 Min.)', quantity: 1, unit_gross_cents: 6500, vat_bps: 1900 },
    { description: 'Aromaöl', quantity: 2, unit_gross_cents: 500, vat_bps: 1900 },
  ],
  vat_bps: 1900,
  is_small_business: false,
  net_cents: 6303,
  vat_cents: 1197,
  gross_cents: 7500,
  paid_with_voucher_cents: 2000,
  currency: 'EUR',
};

describe('invoiceText', () => {
  it('has the §14 UStG facts: number, dates, tax number, lines, VAT split', () => {
    const text = invoiceText(INVOICE);

    expect(text.title).toBe('Rechnung Nr. RE-2026-0001');
    expect(text.meta).toEqual(['Rechnungsdatum: 04.11.2026', 'Leistungsdatum: 04.11.2026']);
    expect(text.sellerTax).toBe('Steuernummer: 30/123/45678');
    expect(text.lines).toEqual([
      { description: 'Thai Massage (60 Min.)', quantity: '1', unit: '65,00 €', total: '65,00 €' },
      { description: 'Aromaöl', quantity: '2', unit: '5,00 €', total: '10,00 €' },
    ]);
    expect(text.totals).toEqual([
      ['Nettobetrag', '63,03 €'],
      ['zzgl. 19 % USt.', '11,97 €'],
      ['Gesamtbetrag', '75,00 €'],
    ]);
    expect(text.notes).toEqual(['Davon mit Gutschein bezahlt: 20,00 €']);
  });

  it('prints the Kleinunternehmer note instead of VAT', () => {
    const text = invoiceText({ ...INVOICE, is_small_business: true, vat_bps: 0, vat_cents: 0, net_cents: 7500, paid_with_voucher_cents: 0 });

    expect(text.totals).toEqual([['Gesamtbetrag', '75,00 €']]);
    expect(text.notes).toEqual(['Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.']);
  });

  it('names the customer with address when given', () => {
    expect(invoiceText({ ...INVOICE, customer_address: 'Musterstr. 1, 22926 Ahrensburg' }).customer)
      .toEqual(['Anna Kunde', 'Musterstr. 1, 22926 Ahrensburg']);
  });
});
