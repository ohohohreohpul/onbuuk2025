/** Plan labels that unlock paid features (social = Zenno Social; custom = tailored plan; standard/premium = legacy names). */
const PAID_PLAN_TYPES = new Set(['pro', 'social', 'custom', 'standard', 'premium']);

export function isPaidPlanType(planType: string | null | undefined): boolean {
  return PAID_PLAN_TYPES.has(planType ?? '');
}
