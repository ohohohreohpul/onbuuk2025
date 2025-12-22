import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';

interface GiftCardCustomization {
  id: string;
  business_id: string;
  title: string;
  subtitle: string;
  select_amount_label: string;
  enter_custom_label: string;
  use_preset_label: string;
  recipient_email_label: string;
  recipient_email_helper: string;
  message_label: string;
  your_details_label: string;
  your_name_label: string;
  your_email_label: string;
  continue_payment_button: string;
  complete_purchase_button: string;
}

const DEFAULT_CUSTOMIZATION: GiftCardCustomization = {
  id: '',
  business_id: '',
  title: 'Purchase a Gift Card',
  subtitle: 'Give the gift of choice with a gift card',
  select_amount_label: 'Select Amount',
  enter_custom_label: 'Enter custom amount',
  use_preset_label: 'Use preset amount',
  recipient_email_label: 'Recipient Email (Optional)',
  recipient_email_helper: 'Leave blank to purchase for yourself, or enter an email to send as a gift',
  message_label: 'Personal Message (Optional)',
  your_details_label: 'Your Details',
  your_name_label: 'Your Name',
  your_email_label: 'Your Email',
  continue_payment_button: 'Continue to Payment',
  complete_purchase_button: 'Complete Purchase',
};

export function useGiftCardCustomization() {
  const { businessId } = useTenant();
  const [customization, setCustomization] = useState<GiftCardCustomization>(DEFAULT_CUSTOMIZATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    const fetchCustomization = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('gift_card_customization')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          setCustomization(data);
        } else {
          setCustomization(DEFAULT_CUSTOMIZATION);
        }
      } catch (err: any) {
        console.error('Error fetching gift card customization:', err);
        setError(err.message);
        setCustomization(DEFAULT_CUSTOMIZATION);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomization();
  }, [businessId]);

  return { customization, loading, error };
}
