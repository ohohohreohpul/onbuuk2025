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
        .from('businesses')
        .select('booking_form_layout')
        .eq('id', businessId)
        .single();

      if (data?.booking_form_layout) {
        setLayoutType(data.booking_form_layout);
      }
      setLoading(false);
    }

    fetchLayout();
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
