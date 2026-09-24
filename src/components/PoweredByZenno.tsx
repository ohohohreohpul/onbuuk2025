import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import { BRAND_LOGO, BRAND_SITE_URL } from '../lib/brand';

export function PoweredByZenno() {
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
      href={BRAND_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Powered by Zenno"
      className="fixed bottom-4 left-4 z-50 group"
    >
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-lg transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-400">
          Powered by
        </span>
        <img src={BRAND_LOGO} alt="Zenno" className="h-4 w-auto" />
      </div>
    </a>
  );
}
