import { describe, expect, it } from 'vitest';
import { defaultSelection, mergeOptions, mergeRequest, type MergeCandidate } from '../mergeChoice';

const GROUP: MergeCandidate[] = [
  { id: 'a', name: 'Anna Müller', email: 'anna@a.de', phone: null, visits_count: 1 },
  { id: 'b', name: 'Anna Mueller', email: 'anna.work@b.de', phone: '0176 111111', visits_count: 7 },
  { id: 'c', name: 'Anna Müller', email: 'ANNA@a.de ', phone: '0176 111111', visits_count: 0 },
];

describe('merge choice', () => {
  it('starts from the customer with most visits', () => {
    expect(defaultSelection(GROUP)).toEqual({ includedIds: ['a', 'b', 'c'], name: 'Anna Mueller', email: 'anna.work@b.de', phone: '0176 111111' });
  });

  it('offers each different value once', () => {
    expect(mergeOptions(GROUP, ['a', 'b', 'c'])).toEqual({
      names: ['Anna Mueller', 'Anna Müller'],
      emails: ['anna.work@b.de', 'anna@a.de'],
      phones: ['0176 111111'],
    });
  });

  it('keeps the customer whose email stays and merges the other ticked ones', () => {
    const request = mergeRequest(GROUP, { includedIds: ['a', 'b'], name: 'Anna Müller', email: 'anna@a.de', phone: null });

    expect(request).toEqual({ keepId: 'a', otherIds: ['b'], name: 'Anna Müller', email: 'anna@a.de', phone: null });
  });

  it('needs at least two customers', () => {
    expect(mergeRequest(GROUP, { includedIds: ['a'], name: 'x', email: 'anna@a.de', phone: null })).toBeNull();
  });
});
