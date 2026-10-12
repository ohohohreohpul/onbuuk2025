import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';

type SettingKey = 'booking_confirmation_mode' | 'send_booking_reminders' | 'notify_owner_bookings';

interface NotificationSettings {
  booking_confirmation_mode: 'auto' | 'manual';
  send_booking_reminders: boolean;
  notify_owner_bookings: boolean;
}

const DEFAULTS: NotificationSettings = {
  booking_confirmation_mode: 'auto',
  send_booking_reminders: true,
  notify_owner_bookings: true,
};

const ROWS: { key: SettingKey; label: string; on: string; off: string }[] = [
  {
    key: 'booking_confirmation_mode',
    label: 'Confirm online bookings automatically',
    on: 'Pay-in-shop bookings are confirmed right away and the customer gets the confirmation email.',
    off: 'Bookings wait for you. The customer gets a "request received" email, then the confirmation when you confirm.',
  },
  {
    key: 'send_booking_reminders',
    label: 'Reminder the day before',
    on: 'Customers get a reminder email 24 hours before their appointment.',
    off: 'No reminder emails.',
  },
  {
    key: 'notify_owner_bookings',
    label: 'Email me about bookings',
    on: 'You get an email for every new or cancelled online booking.',
    off: 'No emails to the shop about bookings.',
  },
];

const isOn = (settings: NotificationSettings, key: SettingKey) =>
  key === 'booking_confirmation_mode' ? settings.booking_confirmation_mode === 'auto' : settings[key];

/** Booking emails: automatic confirmation, reminders, owner notifications. */
export default function BookingNotificationSettings() {
  const { businessId } = useTenant();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('businesses')
      .select('booking_confirmation_mode, send_booking_reminders, notify_owner_bookings')
      .eq('id', businessId)
      .maybeSingle<NotificationSettings>()
      .then(({ data, error: loadError }) => {
        if (loadError) {
          console.error('Could not load booking email settings:', loadError);
          setError('Could not load these settings.');
        }
        if (data) setSettings({ ...DEFAULTS, ...data });
        setIsLoading(false);
      });
  }, [businessId]);

  const toggle = async (key: SettingKey) => {
    if (!businessId) return;
    const value = key === 'booking_confirmation_mode'
      ? (settings.booking_confirmation_mode === 'auto' ? 'manual' : 'auto')
      : !settings[key];
    setSavingKey(key);
    setError(null);
    const { error: saveError } = await supabase.from('businesses').update({ [key]: value }).eq('id', businessId);
    setSavingKey(null);
    if (saveError) {
      console.error('Could not save booking email setting:', saveError);
      setError('Could not save. Please try again.');
      return;
    }
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section aria-labelledby="booking-emails-heading" className="mb-8 rounded-2xl border border-stone-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <BellRing className="h-5 w-5 text-stone-600" aria-hidden="true" />
        <h3 id="booking-emails-heading" className="text-lg font-medium text-stone-900">Booking emails</h3>
      </div>
      <ul className="divide-y divide-stone-100">
        {ROWS.map((row) => {
          const checked = isOn(settings, row.key);
          return (
            <li key={row.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p id={`${row.key}-label`} className="font-medium text-stone-900">{row.label}</p>
                <p className="text-sm text-stone-500">{checked ? row.on : row.off}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={`${row.key}-label`}
                disabled={isLoading || savingKey !== null}
                onClick={() => toggle(row.key)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 disabled:opacity-60 ${checked ? 'bg-[#1A1714]' : 'bg-stone-300'}`}
              >
                {savingKey === row.key ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-white" aria-hidden="true" />
                ) : (
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-3 text-xs text-stone-400">
        Emails go out through the sender configured below. Without a sender, nothing is sent.
      </p>
    </section>
  );
}
