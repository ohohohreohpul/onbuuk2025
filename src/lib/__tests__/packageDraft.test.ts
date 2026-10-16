import { describe, expect, it } from 'vitest';
import { centsToEuro, cleanItems, dayToIso, euroToCents, findProblem, isoToDay } from '../../components/admin/giftCardOrders/packageDraft';
import type { PackageDraft } from '../../components/admin/giftCardOrders/giftCardOrdersApi';

const base: PackageDraft = {
  name: 'Christmas set', subtitle: '', description: '', price_cents: 18000, compare_at_cents: null, bonus_note: '',
  valid_from: null, valid_until: null, stock_limit: null, is_active: true,
  items: [{ kind: 'value', service_id: null, duration_id: null, value_cents: 5000, quantity: 3, label: '' }],
};

describe('voucher set draft', () => {
  it('parses German and plain euro amounts to cents', () => {
    expect(euroToCents('70')).toBe(7000);
    expect(euroToCents('70,5')).toBe(7050);
    expect(euroToCents('1.234,50 €')).toBe(123450);
    expect(euroToCents('12.5')).toBe(1250);
    expect(euroToCents('abc')).toBeNull();
    expect(euroToCents('')).toBeNull();
    expect(centsToEuro(7050)).toBe('70,50');
  });

  it('treats "until" as the whole last day and reads it back', () => {
    const until = dayToIso('2026-12-24', true)!;
    expect(isoToDay(until, true)).toBe('2026-12-24');
    expect(isoToDay(dayToIso('2026-12-01', false), false)).toBe('2026-12-01');
    expect(dayToIso('24.12.2026', false)).toBeNull();
  });

  it('names the first problem of an incomplete set', () => {
    expect(findProblem(base)).toBeNull();
    expect(findProblem({ ...base, name: ' ' })).toBe('needName');
    expect(findProblem({ ...base, price_cents: 0 })).toBe('needPrice');
    expect(findProblem({ ...base, items: [] })).toBe('needItems');
    expect(findProblem({ ...base, items: [{ ...base.items[0], kind: 'service_pass' }] })).toBe('badItem');
    expect(findProblem({ ...base, valid_from: dayToIso('2026-12-10', false), valid_until: dayToIso('2026-12-01', true) })).toBe('badDates');
  });

  it('clears fields that do not belong to the item kind', () => {
    const [pass] = cleanItems([{ kind: 'service_pass', service_id: 's', duration_id: 'd', value_cents: 500, quantity: 2, label: '' }]);
    expect(pass.value_cents).toBeNull();
    const [value] = cleanItems([{ kind: 'value', service_id: 's', duration_id: 'd', value_cents: 500, quantity: 1, label: '' }]);
    expect(value.service_id).toBeNull();
  });
});
