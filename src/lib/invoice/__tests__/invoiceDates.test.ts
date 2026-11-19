import { describe, expect, it } from 'vitest';
import { issueDate, invoiceText } from '../invoiceText';
import { escapeXml } from '../xmlEscape';
import { zugferdXml } from '../zugferdXml';

describe('issueDate', () => {
  it('dates late-evening invoices by German time, like the number year', () => {
    expect(issueDate({ issued_at: '2026-12-31T23:30:00Z' })).toBe('2027-01-01');
    expect(issueDate({ issued_at: '2026-07-01T21:59:00Z' })).toBe('2026-07-01');
    expect(issueDate({ issued_at: '2026-07-01T22:01:00Z' })).toBe('2026-07-02');
  });
});

describe('escapeXml', () => {
  it('escapes markup and drops characters XML 1.0 forbids', () => {
    expect(escapeXml('A&B <x> "q"')).toBe('A&amp;B &lt;x&gt; &quot;q&quot;');
    expect(escapeXml('Anna\u0008 Kunde\u000B\uD800')).toBe('Anna Kunde');
    expect(escapeXml('Tab\tLine\nÖl 😀')).toBe('Tab\tLine\nÖl 😀');
  });
});

describe('PDF and XML agree on the date', () => {
  it('prints and encodes the same Berlin date', () => {
    const invoice = {
      invoice_number: 'RE-2027-0001', issued_at: '2026-12-31T23:30:00Z', service_date: null,
      seller: { name: 'S', address: null, phone: null, tax_number: '1/2/3', vat_id: null, footer: null },
      customer_name: 'A\u0001nna', customer_email: null, customer_address: null,
      items: [{ description: 'X', quantity: 1, unit_gross_cents: 1190, vat_bps: 1900 }],
      vat_bps: 1900, is_small_business: false, net_cents: 1000, vat_cents: 190, gross_cents: 1190, paid_with_voucher_cents: 0, currency: 'EUR',
    };
    expect(invoiceText(invoice).meta[0]).toBe('Rechnungsdatum: 01.01.2027');
    expect(zugferdXml(invoice)).toContain('<udt:DateTimeString format="102">20270101</udt:DateTimeString>');
    expect(zugferdXml(invoice)).toContain('<ram:Name>Anna</ram:Name>');
  });
});
