import { describe, expect, it } from 'vitest';
import { therapistLabel } from '../therapistLabel';

const NAMES = new Map([['a', 'Anna Berg'], ['b', 'Ben']]);

describe('therapistLabel', () => {
  it('names both therapists of a couple booking', () => {
    expect(therapistLabel({ specialist_id: 'a', partner_specialist_id: 'b', is_pair_booking: true }, NAMES)).toBe('Anna Berg & Ben · Couple');
  });

  it('names the single therapist', () => {
    expect(therapistLabel({ specialist_id: 'a', partner_specialist_id: null, is_pair_booking: false }, NAMES)).toBe('Anna Berg');
  });

  it('marks a couple booking whose second therapist is not assigned yet', () => {
    expect(therapistLabel({ specialist_id: 'a', partner_specialist_id: null, is_pair_booking: true }, NAMES)).toBe('Anna Berg · Couple');
  });

  it('falls back when nobody is assigned or the therapist was deleted', () => {
    expect(therapistLabel({ specialist_id: null, partner_specialist_id: null, is_pair_booking: false }, NAMES)).toBe('Any specialist');
    expect(therapistLabel({ specialist_id: 'gone', partner_specialist_id: null, is_pair_booking: false }, NAMES)).toBe('Any specialist');
  });
});
