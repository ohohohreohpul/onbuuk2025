import { describe, expect, it } from 'vitest';
import { invoiceSetupStatus } from '../invoiceSetup';

const SHOP = {
  name: 'SATUUU99', legal_name: null, tax_number: '30/123/45678', vat_id: null, is_small_business: false,
  address: 'Hagener Allee 1, 22926 Ahrensburg', address_line: null, city: null,
};

describe('invoiceSetupStatus', () => {
  it('is complete for a shop with tax number and a readable address', () => {
    expect(invoiceSetupStatus(SHOP)).toEqual({
      taxId: '30/123/45678', invoiceName: 'SATUUU99', isSmallBusiness: false,
      address: { street: 'Hagener Allee 1', postcode: '22926', city: 'Ahrensburg', country: 'DE' }, isAddressReadable: true,
    });
  });

  it('flags a missing tax id and an address without postcode', () => {
    const status = invoiceSetupStatus({ ...SHOP, tax_number: ' ', address: 'Hagener Allee 1 Ahrensburg' });

    expect(status.taxId).toBeNull();
    expect(status.isAddressReadable).toBe(false);
  });

  it('prefers the USt-IdNr. and the legal name', () => {
    const status = invoiceSetupStatus({ ...SHOP, vat_id: 'DE123456789', legal_name: 'SATUUU99 Wellness – Inh. Muster' });

    expect(status.taxId).toBe('DE123456789');
    expect(status.invoiceName).toBe('SATUUU99 Wellness – Inh. Muster');
  });
});
