import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFStream, decodePDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { invoicePdf } from '../invoicePdf';
import type { Invoice } from '../invoiceText';
import { parsePostalAddress } from '../postalAddress';
import { embedZugferd } from '../zugferdPdf';
import { lineNetCents, zugferdXml } from '../zugferdXml';

const INVOICE: Invoice = {
  invoice_number: 'RE-2026-0007',
  issued_at: '2026-11-04T10:00:00Z',
  service_date: '2026-11-03',
  seller: {
    name: 'SATUUU99 Wellness',
    address: 'Hagener Allee 1, 22926 Ahrensburg',
    phone: '04102 123',
    tax_number: '30/123/45678',
    vat_id: 'DE123456789',
    footer: 'IBAN DE00 0000',
  },
  customer_name: 'Anna Kunde',
  customer_email: 'anna@example.de',
  customer_address: 'Firmenweg 5, 20095 Hamburg',
  buyer: { company: 'Muster & Söhne GmbH', vat_id: 'DE987654321', reference: 'PO-4711', street: 'Firmenweg 5', postcode: '20095', city: 'Hamburg', country: 'DE' },
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

const tag = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<ram:${name}[^>]*>([^<]*)</ram:${name}>`, 'g'))].map((m) => m[1]);

const fontBase64 = (file: string) => readFileSync(resolve(__dirname, '../../../assets/fonts', file)).toString('base64');

describe('parsePostalAddress', () => {
  it('splits "street, postcode city"', () => {
    expect(parsePostalAddress('Musterstraße 1, 12345 Berlin'))
      .toEqual({ street: 'Musterstraße 1', postcode: '12345', city: 'Berlin', country: 'DE' });
  });

  it('finds postcode and city in the joined invoice snapshot address', () => {
    expect(parsePostalAddress('Hagener Allee 1, Ahrensburg, Hagener Allee 1, 22926 Ahrensburg'))
      .toEqual({ street: 'Hagener Allee 1', postcode: '22926', city: 'Ahrensburg', country: 'DE' });
  });

  it('keeps only the country when nothing was typed', () => {
    expect(parsePostalAddress(null)).toEqual({ street: null, postcode: null, city: null, country: 'DE' });
  });
});

describe('lineNetCents', () => {
  it('spreads the invoice net over the lines so they add up exactly', () => {
    const nets = lineNetCents(INVOICE);

    expect(nets).toEqual([5463, 840]);
    expect(nets.reduce((a, b) => a + b, 0)).toBe(INVOICE.net_cents);
  });

  it('gives zero lines zero net', () => {
    expect(lineNetCents({ net_cents: 0, items: [{ description: 'x', quantity: 1, unit_gross_cents: 0, vat_bps: 1900 }] })).toEqual([0]);
  });
});

describe('zugferdXml', () => {
  it('writes an EN 16931 invoice with the same numbers as the PDF', () => {
    const xml = zugferdXml(INVOICE);

    expect(tag(xml, 'ID')).toContain('urn:cen.eu:en16931:2017');
    expect(tag(xml, 'ID')).toContain('RE-2026-0007');
    expect(tag(xml, 'TypeCode')[0]).toBe('380');
    expect(tag(xml, 'LineTotalAmount')).toEqual(['54.63', '8.40', '63.03']);
    expect(tag(xml, 'ChargeAmount')).toEqual(['54.63', '4.20']);
    expect(tag(xml, 'TaxBasisTotalAmount')).toEqual(['63.03']);
    expect(tag(xml, 'TaxTotalAmount')).toEqual(['11.97']);
    expect(tag(xml, 'GrandTotalAmount')).toEqual(['75.00']);
    expect(tag(xml, 'TotalPrepaidAmount')).toEqual(['20.00']);
    expect(tag(xml, 'DuePayableAmount')).toEqual(['55.00']);
    expect(tag(xml, 'RateApplicablePercent')).toEqual(['19', '19', '19']);
  });

  it('names the company buyer with VAT id, contact person and reference', () => {
    const xml = zugferdXml(INVOICE);

    expect(tag(xml, 'BuyerReference')).toEqual(['PO-4711']);
    expect(xml).toContain('<ram:Name>Muster &amp; Söhne GmbH</ram:Name>');
    expect(tag(xml, 'PersonName')).toEqual(['Anna Kunde']);
    expect(xml).toContain('<ram:ID schemeID="VA">DE987654321</ram:ID>');
    expect(xml).toContain('<ram:ID schemeID="FC">30/123/45678</ram:ID>');
    expect(tag(xml, 'PostcodeCode')).toEqual(['22926', '20095']);
  });

  it('uses the private customer name when there is no company', () => {
    const xml = zugferdXml({ ...INVOICE, buyer: null, customer_address: null });

    expect(xml).toContain('<ram:BuyerTradeParty><ram:Name>Anna Kunde</ram:Name><ram:PostalTradeAddress><ram:CountryID>DE</ram:CountryID>');
    expect(tag(xml, 'BuyerReference')).toEqual([]);
  });

  it('marks Kleinunternehmer invoices as VAT exempt with the § 19 reason', () => {
    const xml = zugferdXml({ ...INVOICE, is_small_business: true, vat_bps: 0, net_cents: 7500, vat_cents: 0, paid_with_voucher_cents: 0 });

    expect(tag(xml, 'CategoryCode')).toEqual(['E', 'E', 'E']);
    expect(tag(xml, 'ExemptionReason')).toEqual(['Kleinunternehmer gemäß § 19 UStG']);
    expect(tag(xml, 'TaxTotalAmount')).toEqual(['0.00']);
    expect(tag(xml, 'DuePayableAmount')).toEqual(['75.00']);
  });

  it('needs no payment terms when a voucher paid everything', () => {
    const xml = zugferdXml({ ...INVOICE, paid_with_voucher_cents: 7500 });

    expect(tag(xml, 'DuePayableAmount')).toEqual(['0.00']);
    expect(xml).not.toContain('SpecifiedTradePaymentTerms');
  });

  it('identifies a shop with only a Steuernummer by it (BR-CO-26)', () => {
    const xml = zugferdXml({ ...INVOICE, seller: { ...INVOICE.seller, vat_id: null } });

    expect(xml).toContain('<ram:SellerTradeParty><ram:ID>30/123/45678</ram:ID><ram:Name>');
    expect(zugferdXml(INVOICE)).toContain('<ram:SellerTradeParty><ram:Name>');
  });
});

describe('embedZugferd', () => {
  it('attaches factur-x.xml with PDF/A-3 metadata, sRGB intent and embedded fonts', async () => {
    const drawn = invoicePdf(INVOICE, {
      regular: fontBase64('LiberationSans-Regular.ttf'),
      bold: fontBase64('LiberationSans-Bold.ttf'),
    });
    const xml = zugferdXml(INVOICE);

    const bytes = await embedZugferd(new Uint8Array(drawn), xml, { title: 'Rechnung Nr. RE-2026-0007', issuedAt: new Date(INVOICE.issued_at) });
    const pdf = await PDFDocument.load(bytes);
    const catalog = pdf.catalog;

    const names = catalog.lookup(PDFName.of('Names'), PDFDict).lookup(PDFName.of('EmbeddedFiles'), PDFDict);
    const [fileName, fileSpecRef] = names.lookup(PDFName.of('Names'), PDFArray).asArray();
    expect((fileName as PDFHexString).decodeText()).toBe('factur-x.xml');
    const fileSpec = pdf.context.lookup(fileSpecRef, PDFDict);
    expect(fileSpec.get(PDFName.of('AFRelationship'))).toEqual(PDFName.of('Alternative'));
    const embedded = fileSpec.lookup(PDFName.of('EF'), PDFDict).lookup(PDFName.of('F'), PDFStream) as PDFRawStream;
    expect(new TextDecoder().decode(decodePDFRawStream(embedded).decode())).toBe(xml);
    expect(catalog.get(PDFName.of('AF'))).toBeDefined();

    const xmp = new TextDecoder().decode((catalog.lookup(PDFName.of('Metadata'), PDFStream) as PDFRawStream).contents);
    expect(xmp).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(xmp).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>');
    expect(xmp).toContain('<xmp:CreateDate>2026-11-04T10:00:00Z</xmp:CreateDate>');

    expect(String(catalog.lookup(PDFName.of('OutputIntents')))).toContain('GTS_PDFA1');
    expect(pdf.getTitle()).toBe('Rechnung Nr. RE-2026-0007');
    expect(pdf.context.trailerInfo.ID).toBeDefined();

    const fontFiles = pdf.context.enumerateIndirectObjects()
      .filter(([, object]) => object instanceof PDFDict && object.get(PDFName.of('Type')) === PDFName.of('FontDescriptor'))
      .map(([, descriptor]) => (descriptor as PDFDict).get(PDFName.of('FontFile2')));
    expect(fontFiles.length).toBeGreaterThan(0);
    expect(fontFiles.every(Boolean)).toBe(true);
  });

  it('gives the same file for the same invoice (reprints are identical)', async () => {
    const drawn = new Uint8Array(invoicePdf(INVOICE));
    const options = { title: 'Rechnung Nr. RE-2026-0007', issuedAt: new Date(INVOICE.issued_at) };

    const [first, second] = await Promise.all([embedZugferd(drawn, zugferdXml(INVOICE), options), embedZugferd(drawn, zugferdXml(INVOICE), options)]);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });
});
