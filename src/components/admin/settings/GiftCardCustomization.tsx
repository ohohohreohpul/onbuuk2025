import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { AlertCircle, Save } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  loading: string; heading: string; intro: string; saved: string; loadFailed: string; saveFailed: string;
  pageHeader: string; pageTitle: string; pageSubtitle: string;
  amountSelection: string; selectAmountLabel: string; customAmountButton: string; presetAmountButton: string;
  recipientEmail: string; recipientEmailLabel: string; helperText: string;
  personalMessage: string; messageLabel: string;
  buyerDetails: string; sectionHeader: string; nameFieldLabel: string; emailFieldLabel: string;
  purchaseButton: string; continuePaymentButton: string; completePurchaseButton: string;
  saving: string; save: string;
}> = {
  en: {
    loading: 'Loading customization...', heading: 'Gift Card Purchase Page', intro: 'Customize all text on the gift card purchase page',
    saved: 'Gift card customization saved successfully', loadFailed: 'Could not load the gift card texts.', saveFailed: 'Could not save the gift card texts.',
    pageHeader: 'Page Header', pageTitle: 'Page Title', pageSubtitle: 'Page Subtitle',
    amountSelection: 'Amount Selection', selectAmountLabel: 'Select Amount Label', customAmountButton: 'Enter Custom Amount Button', presetAmountButton: 'Use Preset Amount Button',
    recipientEmail: 'Recipient Email', recipientEmailLabel: 'Recipient Email Label', helperText: 'Helper Text',
    personalMessage: 'Personal Message', messageLabel: 'Message Label',
    buyerDetails: 'Buyer Details Section', sectionHeader: 'Section Header', nameFieldLabel: 'Name Field Label', emailFieldLabel: 'Email Field Label',
    purchaseButton: 'Purchase Button', continuePaymentButton: 'Continue to Payment Button', completePurchaseButton: 'Complete Purchase Button',
    saving: 'Saving...', save: 'Save Customization',
  },
  de: {
    loading: 'Texte werden geladen…', heading: 'Gutschein-Kaufseite', intro: 'Alle Texte der Gutschein-Kaufseite anpassen',
    saved: 'Gutschein-Texte gespeichert', loadFailed: 'Gutschein-Texte konnten nicht geladen werden.', saveFailed: 'Gutschein-Texte konnten nicht gespeichert werden.',
    pageHeader: 'Seitenkopf', pageTitle: 'Seitentitel', pageSubtitle: 'Untertitel',
    amountSelection: 'Betragsauswahl', selectAmountLabel: 'Beschriftung „Betrag wählen“', customAmountButton: 'Button „Eigener Betrag“', presetAmountButton: 'Button „Vorgegebener Betrag“',
    recipientEmail: 'E-Mail des Empfängers', recipientEmailLabel: 'Beschriftung Empfänger-E-Mail', helperText: 'Hilfetext',
    personalMessage: 'Persönliche Nachricht', messageLabel: 'Beschriftung Nachricht',
    buyerDetails: 'Bereich Käuferdaten', sectionHeader: 'Bereichsüberschrift', nameFieldLabel: 'Beschriftung Namensfeld', emailFieldLabel: 'Beschriftung E-Mail-Feld',
    purchaseButton: 'Kauf-Button', continuePaymentButton: 'Button „Weiter zur Zahlung“', completePurchaseButton: 'Button „Kauf abschließen“',
    saving: 'Wird gespeichert…', save: 'Speichern',
  },
  th: {
    loading: 'กำลังโหลดข้อความ…', heading: 'หน้าซื้อบัตรของขวัญ', intro: 'ปรับแต่งข้อความทั้งหมดในหน้าซื้อบัตรของขวัญ',
    saved: 'บันทึกข้อความบัตรของขวัญแล้ว', loadFailed: 'โหลดข้อความบัตรของขวัญไม่สำเร็จ', saveFailed: 'บันทึกข้อความบัตรของขวัญไม่สำเร็จ',
    pageHeader: 'ส่วนหัวของหน้า', pageTitle: 'หัวข้อหน้า', pageSubtitle: 'หัวข้อรอง',
    amountSelection: 'การเลือกจำนวนเงิน', selectAmountLabel: 'ป้าย "เลือกจำนวนเงิน"', customAmountButton: 'ปุ่ม "กำหนดจำนวนเอง"', presetAmountButton: 'ปุ่ม "ใช้จำนวนที่กำหนดไว้"',
    recipientEmail: 'อีเมลผู้รับ', recipientEmailLabel: 'ป้ายอีเมลผู้รับ', helperText: 'ข้อความช่วยเหลือ',
    personalMessage: 'ข้อความส่วนตัว', messageLabel: 'ป้ายข้อความ',
    buyerDetails: 'ส่วนข้อมูลผู้ซื้อ', sectionHeader: 'หัวข้อส่วน', nameFieldLabel: 'ป้ายช่องชื่อ', emailFieldLabel: 'ป้ายช่องอีเมล',
    purchaseButton: 'ปุ่มสั่งซื้อ', continuePaymentButton: 'ปุ่ม "ไปที่การชำระเงิน"', completePurchaseButton: 'ปุ่ม "ยืนยันการซื้อ"',
    saving: 'กำลังบันทึก…', save: 'บันทึก',
  },
};

type ErrorKey = '' | 'loadFailed' | 'saveFailed';

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
  const { t } = useAdminText(TEXT);
  const [customization, setCustomization] = useState<GiftCardCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorKey>('');
  const [success, setSuccess] = useState(false);

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
      setError('loadFailed');
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
    setSuccess(false);

    try {
      const saveData = {
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
      };

      if (customization.id) {
        const { error: updateError } = await supabase
          .from('gift_card_customization')
          .update(saveData)
          .eq('id', customization.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('gift_card_customization')
          .insert({
            business_id: businessId,
            ...saveData,
          });

        if (insertError) throw insertError;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving customization:', err);
      setError('saveFailed');
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
    return <div className="text-center text-gray-600">{t.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t.heading}</h2>
        <p className="text-gray-600 mt-1">{t.intro}</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {t[error]}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 text-green-700 rounded-lg">
          {t.saved}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.pageHeader}</h3>
          {renderField(t.pageTitle, 'title')}
          {renderField(t.pageSubtitle, 'subtitle')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.amountSelection}</h3>
          {renderField(t.selectAmountLabel, 'select_amount_label')}
          {renderField(t.customAmountButton, 'enter_custom_label')}
          {renderField(t.presetAmountButton, 'use_preset_label')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.recipientEmail}</h3>
          {renderField(t.recipientEmailLabel, 'recipient_email_label')}
          {renderField(t.helperText, 'recipient_email_helper', true)}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.personalMessage}</h3>
          {renderField(t.messageLabel, 'message_label')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.buyerDetails}</h3>
          {renderField(t.sectionHeader, 'your_details_label')}
          {renderField(t.nameFieldLabel, 'your_name_label')}
          {renderField(t.emailFieldLabel, 'your_email_label')}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">{t.purchaseButton}</h3>
          {renderField(t.continuePaymentButton, 'continue_payment_button')}
          {renderField(t.completePurchaseButton, 'complete_purchase_button')}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
