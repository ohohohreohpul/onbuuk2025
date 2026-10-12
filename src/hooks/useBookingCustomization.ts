import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import { DEFAULT_CUSTOMIZATION } from '../lib/bookingCustomizationDefaults';

export interface StepContent {
  title: string;
  subtitle: string;
  buttonText: string;
  [key: string]: any;
}

export interface BookingFormCustomization {
  id: string;
  business_id: string;
  welcome_step: StepContent;
  service_step: StepContent;
  duration_step: StepContent;
  specialist_step: StepContent;
  datetime_step: StepContent;
  details_step: StepContent;
  addons_step: StepContent;
  payment_step: StepContent;
  global_image_url: string | null;
  welcome_image_url: string | null;
  service_image_url: string | null;
  duration_image_url: string | null;
  specialist_image_url: string | null;
  datetime_image_url: string | null;
  details_image_url: string | null;
  addons_image_url: string | null;
  payment_image_url: string | null;
  welcome_image_mobile: string | null;
  welcome_image_tablet: string | null;
  welcome_image_desktop: string | null;
  service_image_mobile: string | null;
  service_image_tablet: string | null;
  service_image_desktop: string | null;
  duration_image_mobile: string | null;
  duration_image_tablet: string | null;
  duration_image_desktop: string | null;
  specialist_image_mobile: string | null;
  specialist_image_tablet: string | null;
  specialist_image_desktop: string | null;
  datetime_image_mobile: string | null;
  datetime_image_tablet: string | null;
  datetime_image_desktop: string | null;
  details_image_mobile: string | null;
  details_image_tablet: string | null;
  details_image_desktop: string | null;
  addons_image_mobile: string | null;
  addons_image_tablet: string | null;
  addons_image_desktop: string | null;
  payment_image_mobile: string | null;
  payment_image_tablet: string | null;
  payment_image_desktop: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    error: string;
    warning: string;
  };
  typography: {
    fontFamily: string;
    headingSize: string;
    bodySize: string;
    headingWeight: string;
    bodyWeight: string;
  };
  styling: {
    borderRadius: string;
    spacing: string;
    shadowLevel: string;
    progressBarStyle: string;
    showStepNumbers: boolean;
    animationsEnabled: boolean;
    layout: string;
  };
}



export function useBookingCustomization() {
  const { businessId } = useTenant();
  const [customization, setCustomization] = useState<BookingFormCustomization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomization();
  }, [businessId]);

  const fetchCustomization = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('booking_form_customization')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCustomization(data);
      } else {
        setCustomization(DEFAULT_CUSTOMIZATION as BookingFormCustomization);
      }
    } catch (err) {
      console.error('Error fetching booking customization:', err);
      setCustomization(DEFAULT_CUSTOMIZATION as BookingFormCustomization);
    }

    setLoading(false);
  };

  return { customization, loading };
}
