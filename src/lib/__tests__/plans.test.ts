import { describe, expect, it } from 'vitest';
import { isPaidPlanType } from '../plans';

describe('isPaidPlanType', () => {
  it('treats every paid plan label as paid, including Zenno Social', () => {
    for (const plan of ['pro', 'social', 'custom', 'standard', 'premium']) expect(isPaidPlanType(plan)).toBe(true);
  });

  it('treats free, legacy starter and unknown labels as free', () => {
    for (const plan of ['free', 'starter', '', null, undefined]) expect(isPaidPlanType(plan)).toBe(false);
  });
});
