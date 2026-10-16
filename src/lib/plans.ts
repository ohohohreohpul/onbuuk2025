/** Plan labels that unlock paid features (custom = tailored plan; premium = legacy name). */
export function isPaidPlanType(planType: string | null | undefined): boolean {
  return planType === 'pro' || planType === 'custom' || planType === 'premium';
}
