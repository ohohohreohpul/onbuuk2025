import { describe, expect, it } from 'vitest';
import { EMPTY_INVOICE_FORM, invoiceFormProblem, invoiceRequest } from '../invoiceForm';

const COMPANY = {
  ...EMPTY_INVOICE_FORM,
  kind: 'company' as const,
  company: ' Muster GmbH ', street: 'Firmenweg 5', postcode: '20095', city: 'Hamburg', country: 'de', vatId: '', reference: ' PO-1 ',
};

describe('invoiceFormProblem', () => {
  it('lets private invoices up to 250 € go without an address', () => {
    expect(invoiceFormProblem(EMPTY_INVOICE_FORM, 25000)).toBeNull();
  });

  it('asks for the address above 250 €', () => {
    expect(invoiceFormProblem(EMPTY_INVOICE_FORM, 25001)).toBe('missingAddress');
    expect(invoiceFormProblem({ ...EMPTY_INVOICE_FORM, address: 'Weg 1, 12345 Ort' }, 25001)).toBeNull();
  });

  it('needs company, street, postcode and city for a company', () => {
    expect(invoiceFormProblem({ ...COMPANY, city: ' ' }, 100)).toBe('missingCompany');
    expect(invoiceFormProblem({ ...COMPANY, country: 'DEU' }, 100)).toBe('countryInvalid');
    expect(invoiceFormProblem(COMPANY, 100)).toBeNull();
  });
});

describe('invoiceRequest', () => {
  it('sends only the address for private customers', () => {
    expect(invoiceRequest({ ...EMPTY_INVOICE_FORM, address: ' Weg 1 ' })).toEqual({ customerAddress: 'Weg 1' });
    expect(invoiceRequest(EMPTY_INVOICE_FORM)).toEqual({});
  });

  it('sends a trimmed buyer for companies and leaves out empty optional fields', () => {
    expect(invoiceRequest(COMPANY)).toEqual({
      buyer: { company: 'Muster GmbH', street: 'Firmenweg 5', postcode: '20095', city: 'Hamburg', country: 'DE', vat_id: undefined, reference: 'PO-1' },
    });
  });
});
