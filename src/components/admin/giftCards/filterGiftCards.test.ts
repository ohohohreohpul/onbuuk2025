import { describe, expect, it } from 'vitest';
import { filterGiftCards } from './filterGiftCards';

const cards = [
  { code: 'SATU-AB12-CD34', purchased_by_name: 'Frederike Albers', purchased_for_email: 'kiki@example.de', service_pass_name: null },
  { code: 'SATU-ZZ99-XY00', purchased_by_email: 'buyer@shop.de', purchased_for_email: null, service_pass_name: 'Thai Massage 5×' },
];

describe('filterGiftCards', () => {
  it('returns every card for an empty query', () => {
    expect(filterGiftCards(cards, '  ')).toHaveLength(2);
  });

  it('matches a code typed without dashes or in lower case', () => {
    expect(filterGiftCards(cards, 'ab12cd').map((c) => c.code)).toEqual(['SATU-AB12-CD34']);
  });

  it('matches buyer name, recipient email and product', () => {
    expect(filterGiftCards(cards, 'albers')).toHaveLength(1);
    expect(filterGiftCards(cards, 'KIKI@')).toHaveLength(1);
    expect(filterGiftCards(cards, 'thai massage')[0].code).toBe('SATU-ZZ99-XY00');
  });

  it('returns nothing when no field matches', () => {
    expect(filterGiftCards(cards, 'nobody')).toEqual([]);
  });
});
