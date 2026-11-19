/**
 * EN 16931 invoice as UN/CEFACT CII XML - the machine-readable part of a
 * ZUGFeRD 2.3 / Factur-X "EN 16931" PDF (German E-Rechnung).
 *
 * Built from the same immutable invoice snapshot as the PDF, so both always
 * say the same. Prices in Zenno are gross; the stored net/VAT split is kept and
 * the net is spread over the lines (EN 16931 allows ±1 on the VAT amount).
 */
import { issueDate, type Invoice } from './invoiceText';
import { parsePostalAddress, type PostalAddress } from './postalAddress';
import { escapeXml } from './xmlEscape';

export const ZUGFERD_FILE_NAME = 'factur-x.xml';
const EN16931_GUIDELINE = 'urn:cen.eu:en16931:2017';
const SMALL_BUSINESS_REASON = 'Kleinunternehmer gemäß § 19 UStG';
const VAT_FREE_REASON = 'Umsatzsteuerfrei';
const UNIT_PIECE = 'C62';

const amount = (cents: number) => (cents / 100).toFixed(2);

/** Net unit price with up to 4 decimals (a line net may not divide evenly by its quantity). */
const unitPrice = (lineCents: number, quantity: number) =>
  (lineCents / quantity / 100).toFixed(4).replace(/(\.\d{2}\d*?)0+$/, '$1');

const percent = (bps: number) => String(bps / 100);

const xmlDate = (value: string) => value.slice(0, 10).replace(/-/g, '');

/**
 * Splits the invoice net over the lines in proportion to their gross price,
 * so the line nets add up to exactly invoice.net_cents.
 */
export function lineNetCents(invoice: Pick<Invoice, 'items' | 'net_cents'>): number[] {
  const grosses = invoice.items.map((item) => item.quantity * item.unit_gross_cents);
  const totalGross = grosses.reduce((sum, value) => sum + value, 0);
  if (totalGross === 0) return grosses.map(() => 0);

  const exact = grosses.map((gross) => (gross * invoice.net_cents) / totalGross);
  const nets = exact.map(Math.floor);
  let rest = invoice.net_cents - nets.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (rest <= 0) break;
    nets[index] += 1;
    rest -= 1;
  }
  return nets;
}

function postalXml(address: PostalAddress): string {
  return [
    '<ram:PostalTradeAddress>',
    address.postcode ? `<ram:PostcodeCode>${escapeXml(address.postcode)}</ram:PostcodeCode>` : '',
    address.street ? `<ram:LineOne>${escapeXml(address.street)}</ram:LineOne>` : '',
    address.city ? `<ram:CityName>${escapeXml(address.city)}</ram:CityName>` : '',
    `<ram:CountryID>${escapeXml(address.country)}</ram:CountryID>`,
    '</ram:PostalTradeAddress>',
  ].join('');
}

function sellerXml(invoice: Invoice): string {
  const { seller } = invoice;
  // BR-CO-26: without a USt-IdNr the buyer needs another seller identifier (BT-29).
  const sellerId = !seller.vat_id && seller.tax_number ? `<ram:ID>${escapeXml(seller.tax_number)}</ram:ID>` : '';
  return [
    '<ram:SellerTradeParty>',
    sellerId,
    `<ram:Name>${escapeXml(seller.name)}</ram:Name>`,
    seller.phone
      ? `<ram:DefinedTradeContact><ram:TelephoneUniversalCommunication><ram:CompleteNumber>${escapeXml(seller.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication></ram:DefinedTradeContact>`
      : '',
    postalXml(parsePostalAddress(seller.address)),
    seller.tax_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${escapeXml(seller.tax_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : '',
    seller.vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(seller.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : '',
    '</ram:SellerTradeParty>',
  ].join('');
}

function buyerXml(invoice: Invoice): string {
  const { buyer } = invoice;
  if (!buyer) {
    return `<ram:BuyerTradeParty><ram:Name>${escapeXml(invoice.customer_name)}</ram:Name>${postalXml(parsePostalAddress(invoice.customer_address))}</ram:BuyerTradeParty>`;
  }
  const address: PostalAddress = {
    street: buyer.street ?? null, postcode: buyer.postcode ?? null, city: buyer.city ?? null, country: buyer.country,
  };
  return [
    '<ram:BuyerTradeParty>',
    `<ram:Name>${escapeXml(buyer.company)}</ram:Name>`,
    `<ram:DefinedTradeContact><ram:PersonName>${escapeXml(invoice.customer_name)}</ram:PersonName></ram:DefinedTradeContact>`,
    postalXml(address),
    buyer.vat_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(buyer.vat_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : '',
    '</ram:BuyerTradeParty>',
  ].join('');
}

interface TaxCategory {
  code: 'S' | 'E';
  rate: string;
  reason: string | null;
}

function taxCategory(invoice: Invoice): TaxCategory {
  if (invoice.is_small_business) return { code: 'E', rate: '0', reason: SMALL_BUSINESS_REASON };
  if (invoice.vat_bps === 0) return { code: 'E', rate: '0', reason: VAT_FREE_REASON };
  return { code: 'S', rate: percent(invoice.vat_bps), reason: null };
}

function lineXml(invoice: Invoice, tax: TaxCategory, nets: number[]): string {
  return invoice.items.map((item, index) => [
    '<ram:IncludedSupplyChainTradeLineItem>',
    `<ram:AssociatedDocumentLineDocument><ram:LineID>${index + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>`,
    `<ram:SpecifiedTradeProduct><ram:Name>${escapeXml(item.description)}</ram:Name></ram:SpecifiedTradeProduct>`,
    `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${unitPrice(nets[index], item.quantity)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>`,
    `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${UNIT_PIECE}">${item.quantity}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>`,
    '<ram:SpecifiedLineTradeSettlement>',
    `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${tax.code}</ram:CategoryCode><ram:RateApplicablePercent>${tax.rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`,
    `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(nets[index])}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>`,
    '</ram:SpecifiedLineTradeSettlement>',
    '</ram:IncludedSupplyChainTradeLineItem>',
  ].join('')).join('');
}

function settlementXml(invoice: Invoice, tax: TaxCategory): string {
  const currency = escapeXml(invoice.currency || 'EUR');
  const prepaid = invoice.paid_with_voucher_cents;
  const due = invoice.gross_cents - prepaid;
  return [
    '<ram:ApplicableHeaderTradeSettlement>',
    `<ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>`,
    '<ram:ApplicableTradeTax>',
    `<ram:CalculatedAmount>${amount(invoice.vat_cents)}</ram:CalculatedAmount>`,
    '<ram:TypeCode>VAT</ram:TypeCode>',
    tax.reason ? `<ram:ExemptionReason>${escapeXml(tax.reason)}</ram:ExemptionReason>` : '',
    `<ram:BasisAmount>${amount(invoice.net_cents)}</ram:BasisAmount>`,
    `<ram:CategoryCode>${tax.code}</ram:CategoryCode>`,
    `<ram:RateApplicablePercent>${tax.rate}</ram:RateApplicablePercent>`,
    '</ram:ApplicableTradeTax>',
    due > 0 ? '<ram:SpecifiedTradePaymentTerms><ram:Description>Zahlbar sofort ohne Abzug.</ram:Description></ram:SpecifiedTradePaymentTerms>' : '',
    '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    `<ram:LineTotalAmount>${amount(invoice.net_cents)}</ram:LineTotalAmount>`,
    `<ram:TaxBasisTotalAmount>${amount(invoice.net_cents)}</ram:TaxBasisTotalAmount>`,
    `<ram:TaxTotalAmount currencyID="${currency}">${amount(invoice.vat_cents)}</ram:TaxTotalAmount>`,
    `<ram:GrandTotalAmount>${amount(invoice.gross_cents)}</ram:GrandTotalAmount>`,
    prepaid > 0 ? `<ram:TotalPrepaidAmount>${amount(prepaid)}</ram:TotalPrepaidAmount>` : '',
    `<ram:DuePayableAmount>${amount(due)}</ram:DuePayableAmount>`,
    '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    '</ram:ApplicableHeaderTradeSettlement>',
  ].join('');
}

/** The factur-x.xml for one invoice (Factur-X / ZUGFeRD profile EN 16931). */
export function zugferdXml(invoice: Invoice): string {
  const tax = taxCategory(invoice);
  const nets = lineNetCents(invoice);
  const notes = [invoice.seller.footer].filter((note): note is string => Boolean(note));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
    `<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${EN16931_GUIDELINE}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>`,
    '<rsm:ExchangedDocument>',
    `<ram:ID>${escapeXml(invoice.invoice_number)}</ram:ID>`,
    '<ram:TypeCode>380</ram:TypeCode>',
    `<ram:IssueDateTime><udt:DateTimeString format="102">${xmlDate(issueDate(invoice))}</udt:DateTimeString></ram:IssueDateTime>`,
    ...notes.map((note) => `<ram:IncludedNote><ram:Content>${escapeXml(note)}</ram:Content></ram:IncludedNote>`),
    '</rsm:ExchangedDocument>',
    '<rsm:SupplyChainTradeTransaction>',
    lineXml(invoice, tax, nets),
    '<ram:ApplicableHeaderTradeAgreement>',
    invoice.buyer?.reference ? `<ram:BuyerReference>${escapeXml(invoice.buyer.reference)}</ram:BuyerReference>` : '',
    sellerXml(invoice),
    buyerXml(invoice),
    '</ram:ApplicableHeaderTradeAgreement>',
    '<ram:ApplicableHeaderTradeDelivery>',
    invoice.service_date
      ? `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${xmlDate(invoice.service_date)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>`
      : '',
    '</ram:ApplicableHeaderTradeDelivery>',
    settlementXml(invoice, tax),
    '</rsm:SupplyChainTradeTransaction>',
    '</rsm:CrossIndustryInvoice>',
  ].join('\n');
}
