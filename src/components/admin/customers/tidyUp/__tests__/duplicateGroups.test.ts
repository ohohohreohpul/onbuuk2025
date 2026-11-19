import { describe, expect, it } from 'vitest';
import { findDuplicateGroups, nameKey, pairKey, phoneKey, type TidyCustomer } from '../duplicateGroups';

const customer = (id: string, name: string, email: string, phone: string | null = null): TidyCustomer => ({ id, name, email, phone });

const ids = (groups: ReturnType<typeof findDuplicateGroups>) => groups.map((group) => group.customers.map((c) => c.id).sort());

describe('keys', () => {
  it('normalises German phone numbers like the database', () => {
    expect(phoneKey('+49 176 1234567')).toBe('01761234567');
    expect(phoneKey('0049-176-1234567')).toBe('01761234567');
    expect(phoneKey('0176 / 123 45 67')).toBe('01761234567');
    expect(phoneKey('12')).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });

  it('matches names in any order and without accents, but never a first name alone', () => {
    expect(nameKey('Müller, Anna')).toBe(nameKey('anna  MULLER'));
    expect(nameKey('Anna')).toBeNull();
  });
});

describe('findDuplicateGroups', () => {
  it('finds the three Planity cases: same name, same email, same phone', () => {
    const groups = findDuplicateGroups([
      customer('1', 'Anna Müller', 'anna@a.de', '0176 111111'),
      customer('2', 'Anna Mueller', 'ANNA@a.de '),          // same email, other spelling
      customer('3', 'Tom Klein', 'tom@a.de', '+49 30 999999'),
      customer('4', 'Thomas Klein', 'thomas@b.de', '030 999999'), // same phone
      customer('5', 'Lisa Berg', 'lisa@a.de'),
      customer('6', 'Berg Lisa', 'lisa.berg@b.de'),          // same name only
      customer('7', 'Solo Person', 'solo@a.de'),
    ], new Set());

    expect(ids(groups)).toEqual([['1', '2'], ['3', '4'], ['5', '6']]);
    expect(groups.map((group) => [group.reasons, group.isLikely])).toEqual([
      [['email'], true],
      [['phone'], true],
      [['name'], false],
    ]);
  });

  it('chains matches into one group and lists every reason', () => {
    const groups = findDuplicateGroups([
      customer('1', 'Anna Müller', 'anna@a.de', '0176 111111'),
      customer('2', 'Anna Müller', 'anna.work@b.de'),
      customer('3', 'A. M.', 'other@c.de', '+49 176 111111'),
    ], new Set());

    expect(ids(groups)).toEqual([['1', '2', '3']]);
    expect(groups[0].reasons).toEqual(['phone', 'name']);
  });

  it('respects "not the same person"', () => {
    const list = [customer('1', 'Lisa Berg', 'a@a.de'), customer('2', 'Lisa Berg', 'b@b.de')];

    expect(findDuplicateGroups(list, new Set([pairKey('2', '1')]))).toEqual([]);
  });

  it('ignores junk values shared by many customers', () => {
    const many = Array.from({ length: 25 }, (_, index) => customer(String(index), `Person ${index} X`, `p${index}@a.de`, '000000'));

    expect(findDuplicateGroups(many, new Set())).toEqual([]);
  });
});
