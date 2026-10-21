import { describe, expect, it } from 'vitest';
import { duplicateMinutes, planDurationChanges } from './durationChanges';

const stored = [
  { id: 'a', duration_minutes: 60, price_cents: 8000 },
  { id: 'b', duration_minutes: 90, price_cents: 11000 },
];

describe('planDurationChanges', () => {
  it('updates a changed price in place instead of adding a new row', () => {
    const plan = planDurationChanges(stored, [
      { id: 'a', duration_minutes: 60, price_cents: 8500 },
      { id: 'b', duration_minutes: 90, price_cents: 11000 },
    ]);
    expect(plan.updates).toEqual([{ id: 'a', duration_minutes: 60, price_cents: 8500 }]);
    expect(plan.inserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it('inserts new rows and deletes removed ones', () => {
    const plan = planDurationChanges(stored, [
      { id: 'a', duration_minutes: 60, price_cents: 8000 },
      { duration_minutes: 30, price_cents: 4500 },
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([{ duration_minutes: 30, price_cents: 4500 }]);
    expect(plan.deletes.map((row) => row.id)).toEqual(['b']);
  });

  it('does nothing when nothing changed', () => {
    expect(planDurationChanges(stored, stored)).toEqual({ updates: [], inserts: [], deletes: [] });
  });
});

describe('duplicateMinutes', () => {
  it('finds a repeated length', () => {
    expect(duplicateMinutes([{ duration_minutes: 60, price_cents: 1 }, { duration_minutes: 60, price_cents: 2 }])).toBe(60);
    expect(duplicateMinutes(stored)).toBeNull();
  });
});
