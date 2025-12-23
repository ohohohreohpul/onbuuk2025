import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';

export function PoweredByBuuk() {
  const tenant = useTenant();
  const [shouldShow, setShouldShow] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkVisibility() {
      if (!tenant.businessId) {
        setShouldShow(true);
        setIsLoading(false);
        return;
      }

      const { data: business } = await supabase
        .from('businesses')
        .select('hide_powered_by_badge, plan_type')
        .eq('id', tenant.businessId)
        .maybeSingle();

      const isPro = business?.plan_type === 'pro' || business?.plan_type === 'premium';
      const isFree = business?.plan_type === 'free' || business?.plan_type === 'starter';

      if (isFree) {
        setShouldShow(true);
      } else if (isPro && business?.hide_powered_by_badge) {
        setShouldShow(false);
      } else {
        setShouldShow(true);
      }

      setIsLoading(false);
    }

    checkVisibility();
  }, [tenant.businessId]);

  if (isLoading || !shouldShow) {
    return null;
  }

  return (
    <a
      href="https://onbuuk.com"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-4 z-50 group"
      style={{ maxWidth: '140px' }}
    >
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-[#008374]/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-110" />
        {/* Badge container */}
        <div className="relative bg-white/80 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg border border-white/50 transition-all duration-300 group-hover:shadow-xl group-hover:bg-white group-hover:scale-105">
          <img
            src="/Powered by buuk.png"
            alt="Powered by buuk"
            className="w-full h-auto"
          />
        </div>
      </div>
    </a>
  );
}
