import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { AlertCircle, Save } from 'lucide-react';

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

const DEFAULT_CUSTOMIZATION: Omit<GiftCardCustomization, 'id' | 'business_id'> = {
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

export function GiftCardCustomization() {
  const { businessId } = useTenant();
  const [customization, setCustomization] = useState<GiftCardCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (businessId) {
      loadCustomization();
    }
  }, [businessId]);

  const loadCustomization = async () => {
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
        setCustomization({
          id: '',
          business_id: businessId,
          ...DEFAULT_CUSTOMIZATION,
        });
      }
    } catch (err: any) {
      console.error('Error loading customization:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    if (customization) {
      setCustomization({
        ...customization,
        [field]: value,
      });
    }
  };

  const handleSave = async () => {
    if (!customization) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (customization.id) {
        const { error: updateError } = await supabase
          .from('gift_card_customization')
          .update({
            title: customization.title,
            subtitle: customization.subtitle,
            select_amount_label: customization.select_amount_label,
            enter_custom_label: customization.enter_custom_label,
            use_preset_label: customization.use_preset_label,
            recipient_email_label: customization.recipient_email_label,
            recipient_email_helper: customization.recipient_email_helper,
            message_label: customization.message_label,
            your_details_label: customization.your_details_label,
            your_name_label: customization.your_name_label,
            your_email_label: customization.your_email_label,
            continue_payment_button: customization.continue_payment_button,
            complete_purchase_button: customization.complete_purchase_button,
          })
          .eq('id', customization.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('gift_card_customization')
          .insert({
            business_id: businessId,
            ...DEFAULT_CUSTOMIZATION,
            ...customization,
          });

        if (insertError) throw insertError;
      }

      setSuccess('Gift card customization saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error saving customization:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label: string, field: string, isTextarea = false) => {
    if (!customization) return null;

    return (
      <div key={field} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {isTextarea ? (
          <textarea
            value={customization[field as keyof GiftCardCustomization] as string}
            onChange={(e) => handleChange(field, e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          />
        ) : (
          <input
            type="text"
            value={customization[field as keyof GiftCardCustomization] as string}
            onChange={(e) => handleChange(field, e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          />
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center text-gray-600">Loading customization...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gift Card Purchase Page</h2>
        <p className="text-gray-600 mt-1">Customize all text on the gift card purchase page</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Page Header</h3>
          {renderField('Page Title', 'title')}
          {renderField('Page Subtitle', 'subtitle')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Amount Selection</h3>
          {renderField('Select Amount Label', 'select_amount_label')}
          {renderField('Enter Custom Amount Button', 'enter_custom_label')}
          {renderField('Use Preset Amount Button', 'use_preset_label')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Recipient Email</h3>
          {renderField('Recipient Email Label', 'recipient_email_label')}
          {renderField('Helper Text', 'recipient_email_helper', true)}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Personal Message</h3>
          {renderField('Message Label', 'message_label')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Buyer Details Section</h3>
          {renderField('Section Header', 'your_details_label')}
          {renderField('Name Field Label', 'your_name_label')}
          {renderField('Email Field Label', 'your_email_label')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Purchase Button</h3>
          {renderField('Continue to Payment Button', 'continue_payment_button')}
          {renderField('Complete Purchase Button', 'complete_purchase_button')}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Customization'}
        </button>
      </div>
    </div>
  );
}
