import { ReactNode, useEffect, useState } from 'react';
import { useTenant } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';
import DefaultLayout from './layouts/DefaultLayout';
import VerticalLayout from './layouts/VerticalLayout';
import MinimalLayout from './layouts/MinimalLayout';
import SplitPanelLayout from './layouts/SplitPanelLayout';

interface BookingLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  bookingSummary?: {
    service?: string;
    serviceType?: string;
    duration?: string;
    specialist?: string;
    date?: string;
    time?: string;
    total?: string;
  };
}

export default function BookingLayout({ children, imageUrl, imageAlt, bookingSummary }: BookingLayoutProps) {
  const { businessId } = useTenant();
  const [layoutType, setLayoutType] = useState<string>('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLayout() {
      if (!businessId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('booking_form_customization')
        .select('styling')
        .eq('business_id', businessId)
        .maybeSingle();

      if (data?.styling?.layout) {
        setLayoutType(data.styling.layout);
      }
      setLoading(false);
    }

    fetchLayout();

    const subscription = supabase
      .channel(`booking_layout_${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_form_customization',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const newData = payload.new as { styling?: { layout?: string } };
            if (newData.styling?.layout) {
              setLayoutType(newData.styling.layout);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [businessId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 relative">
        <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="w-10 h-10 border-3 border-[#008374]/20 border-t-[#008374] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const layoutProps = {
    children,
    imageUrl,
    imageAlt,
  };

  switch (layoutType) {
    case 'vertical':
      return <VerticalLayout {...layoutProps} />;
    case 'minimal':
      return <MinimalLayout {...layoutProps} />;
    case 'split-panel':
      return <SplitPanelLayout {...layoutProps} bookingSummary={bookingSummary} />;
    case 'default':
    default:
      return <DefaultLayout {...layoutProps} />;
  }
}
