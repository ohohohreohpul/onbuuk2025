import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';

export type PlanType = 'free' | 'standard' | 'pro';

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
      maxStaff: 2,
      maxServices: 5,
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
            maxStaff: 2,
            maxServices: 5,
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

      const planType = (business?.plan_type === 'pro' || business?.plan_type === 'premium')
        ? 'pro'
        : business?.plan_type === 'standard'
          ? 'standard'
          : 'free';
      const isPro = planType === 'pro';
      const isStandard = planType === 'standard';
      const isFree = planType === 'free';

      setFeatures({
        planType,
        isPro,
        canUseCustomLogo: isPro,
        canHidePoweredBy: isPro,
        canUseCalendarIntegration: isPro,
        canUseCustomDomain: isPro,
        canUseAdvancedPermissions: isPro || isStandard,
        canUseAdvancedFormCustomization: isPro || isStandard,
        limits: {
          maxStaff: business?.max_staff_count ?? (isPro ? null : isStandard ? 5 : 2),
          maxServices: business?.max_services_count ?? (isPro ? null : isStandard ? 20 : 5),
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
