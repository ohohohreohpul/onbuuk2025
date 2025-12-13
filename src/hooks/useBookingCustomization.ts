import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';

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
  welcome_image_url: string | null;
  service_image_url: string | null;
  duration_image_url: string | null;
  specialist_image_url: string | null;
  datetime_image_url: string | null;
  details_image_url: string | null;
  addons_image_url: string | null;
  payment_image_url: string | null;
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

const DEFAULT_CUSTOMIZATION: Partial<BookingFormCustomization> = {
  welcome_step: {
    title: "Welcome! Let's get you booked",
    subtitle: "Choose your preferred service and time",
    buttonText: "Get Started"
  },
  service_step: {
    title: "Choose Your Service",
    subtitle: "Select the service you would like to book",
    buttonText: "Continue"
  },
  duration_step: {
    title: "Select Duration",
    subtitle: "How long would you like your appointment?",
    buttonText: "Continue"
  },
  specialist_step: {
    title: "Choose Your Specialist",
    subtitle: "Select your preferred specialist or let us choose for you",
    buttonText: "Continue",
    anySpecialistText: "Any Available Specialist"
  },
  datetime_step: {
    title: "Select Date & Time",
    subtitle: "Choose your preferred appointment date and time",
    buttonText: "Continue"
  },
  details_step: {
    title: "Your Details",
    subtitle: "Please provide your contact information",
    buttonText: "Continue",
    labels: {
      name: "Full Name",
      email: "Email Address",
      phone: "Phone Number",
      notes: "Additional Notes (Optional)"
    }
  },
  addons_step: {
    title: "Enhance Your Experience",
    subtitle: "Add optional products or services",
    buttonText: "Continue",
    skipButtonText: "Skip Add-ons"
  },
  payment_step: {
    title: "Payment",
    subtitle: "Complete your booking",
    buttonText: "Confirm Booking"
  }
};

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
