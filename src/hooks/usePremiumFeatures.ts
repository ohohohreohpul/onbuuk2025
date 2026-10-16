import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import { isPaidPlanType } from '../lib/plans';

export type PlanType = 'free' | 'standard' | 'pro';

// Free plan limits (also enforced in the database: private.enforce_free_plan_limits).
const FREE_MAX_STAFF = 1;
const FREE_MAX_SERVICES = 5;

export interface TierLimits {
  maxStaff: number | null;
  maxServices: number | null;
  maxBookings: number | null;
  currentStaff: number;
  currentServices: number;
  currentBookings: number;
}

export interface PremiumFeatures {
  planType: PlanType;
  isPro: boolean;
  canUseCustomLogo: boolean;
  canHidePoweredBy: boolean;
  canUseCalendarIntegration: boolean;
  canUseCustomDomain: boolean;
  canUseAdvancedPermissions: boolean;
  canUseAdvancedFormCustomization: boolean;
  limits: TierLimits;
  isLoading: boolean;
}

export function usePremiumFeatures(): PremiumFeatures {
  const tenant = useTenant();
  const [features, setFeatures] = useState<PremiumFeatures>({
    planType: 'free',
    isPro: false,
    canUseCustomLogo: false,
    canHidePoweredBy: false,
    canUseCalendarIntegration: false,
    canUseCustomDomain: false,
    canUseAdvancedPermissions: false,
    canUseAdvancedFormCustomization: false,
    limits: {
      maxStaff: FREE_MAX_STAFF,
      maxServices: FREE_MAX_SERVICES,
      maxBookings: 50,
      currentStaff: 0,
      currentServices: 0,
      currentBookings: 0,
    },
    isLoading: true,
  });

  useEffect(() => {
    async function checkPremiumStatus() {
      if (!tenant.businessId) {
        setFeatures({
          planType: 'free',
          isPro: false,
          canUseCustomLogo: false,
          canHidePoweredBy: false,
          canUseCalendarIntegration: false,
          canUseCustomDomain: false,
          canUseAdvancedPermissions: false,
          canUseAdvancedFormCustomization: false,
          limits: {
            maxStaff: FREE_MAX_STAFF,
            maxServices: FREE_MAX_SERVICES,
            maxBookings: 50,
            currentStaff: 0,
            currentServices: 0,
            currentBookings: 0,
          },
          isLoading: false,
        });
        return;
      }

      const { data: business } = await supabase
        .from('businesses')
        .select('plan_type, max_staff_count, max_services_count, current_staff_count, current_services_count')
        .eq('id', tenant.businessId)
        .maybeSingle();

      const planType: PlanType = isPaidPlanType(business?.plan_type) ? 'pro' : 'free';
      const isPro = planType === 'pro';
      const isFree = planType === 'free';

      setFeatures({
        planType,
        isPro,
        canUseCustomLogo: isPro,
        canHidePoweredBy: isPro,
        canUseCalendarIntegration: isPro,
        canUseCustomDomain: isPro,
        canUseAdvancedPermissions: isPro,
        canUseAdvancedFormCustomization: isPro,
        limits: {
          maxStaff: isPro ? null : FREE_MAX_STAFF,
          maxServices: isPro ? null : FREE_MAX_SERVICES,
          maxBookings: isFree ? 50 : null,
          currentStaff: business?.current_staff_count ?? 0,
          currentServices: business?.current_services_count ?? 0,
          currentBookings: 0,
        },
        isLoading: false,
      });
    }

    checkPremiumStatus();
  }, [tenant.businessId]);

  return features;
}
