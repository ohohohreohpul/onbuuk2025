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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">Loading...</div>
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
