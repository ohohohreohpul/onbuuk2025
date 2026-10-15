import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { BOOKING_LANGUAGES, type BookingLanguage, type Translations } from '../../../lib/bookingLanguage';
import { ADMIN_SELECT } from '../adminUi';
import { useAdminText } from '../../../lib/adminLanguage';

const TEXT: Translations<{ label: string; help: string; saved: string; saveFailed: string }> = {
  en: {
    label: 'Language of booking page and emails',
    help: 'Booking page, voucher shop, cancel page and the emails your customers get.',
    saved: 'Saved. Customers see the new language on their next visit.', saveFailed: 'Could not save. Please try again.',
  },
  de: {
    label: 'Sprache von Buchungsseite und E-Mails',
    help: 'Buchungsseite, Gutschein-Shop, Stornoseite und die E-Mails an Ihre Kunden.',
    saved: 'Gespeichert. Kunden sehen die neue Sprache beim nächsten Besuch.', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  },
  th: {
    label: 'ภาษาของหน้าจองและอีเมล',
    help: 'หน้าจอง, ร้านบัตรของขวัญ, หน้ายกเลิก และอีเมลที่ลูกค้าได้รับ',
    saved: 'บันทึกแล้ว ลูกค้าจะเห็นภาษาใหม่ในการเข้าชมครั้งถัดไป', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
};

/** Language of the customer-facing pages (booking, vouchers, cancel) and booking emails. */
export default function BookingLanguageSetting() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const [language, setLanguage] = useState<BookingLanguage>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'saved' | 'saveFailed' | null>(null);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('businesses')
      .select('language')
      .eq('id', businessId)
      .maybeSingle<{ language: BookingLanguage | null }>()
      .then(({ data, error }) => {
        if (error) console.error('Could not load the booking language:', error);
        setLanguage(data?.language ?? 'en');
        setIsLoading(false);
      });
  }, [businessId]);

  const change = async (next: BookingLanguage) => {
    if (!businessId) return;
    const previous = language;
    setLanguage(next);
    setStatus(null);
    const { error } = await supabase.from('businesses').update({ language: next }).eq('id', businessId);
    if (error) {
      console.error('Could not save the booking language:', error);
      setLanguage(previous);
      setStatus('saveFailed');
      return;
    }
    setStatus('saved');
  };

  return (
    <div className="rounded-xl border border-stone-200 p-5">
      <div className="flex items-start gap-3">
        <Languages className="mt-0.5 h-5 w-5 text-stone-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <label htmlFor="booking-language" className="font-semibold text-stone-900">{t.label}</label>
          <p className="text-sm text-stone-500">{t.help}</p>
          <select
            id="booking-language"
            className={`${ADMIN_SELECT} mt-3 sm:w-64`}
            value={language}
            disabled={isLoading}
            onChange={(e) => change(e.target.value as BookingLanguage)}
          >
            {BOOKING_LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {status && (
            <p role={status === 'saveFailed' ? 'alert' : 'status'} className={`mt-2 text-sm ${status === 'saveFailed' ? 'text-red-600' : 'text-emerald-700'}`}>{t[status]}</p>
          )}
        </div>
      </div>
    </div>
  );
}
