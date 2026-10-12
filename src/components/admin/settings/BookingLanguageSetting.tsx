import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { BOOKING_LANGUAGES, type BookingLanguage } from '../../../lib/bookingLanguage';
import { ADMIN_SELECT } from '../adminUi';

/** Language of the customer-facing pages (booking, vouchers, cancel) and booking emails. */
export default function BookingLanguageSetting() {
  const { businessId } = useTenant();
  const [language, setLanguage] = useState<BookingLanguage>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

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
      setStatus({ tone: 'error', text: 'Could not save. Please try again.' });
      return;
    }
    setStatus({ tone: 'success', text: 'Saved. Customers see the new language on their next visit.' });
  };

  return (
    <div className="rounded-xl border border-stone-200 p-5">
      <div className="flex items-start gap-3">
        <Languages className="mt-0.5 h-5 w-5 text-stone-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <label htmlFor="booking-language" className="font-semibold text-stone-900">Language of booking page and emails</label>
          <p className="text-sm text-stone-500">Booking page, voucher shop, cancel page and the emails your customers get.</p>
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
            <p role={status.tone === 'error' ? 'alert' : 'status'} className={`mt-2 text-sm ${status.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{status.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}
