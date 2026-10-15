import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';

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

type TextKey = keyof typeof TEXT.en;

const TEXT: Translations<{
  heading: string; confirmLabel: string; confirmOn: string; confirmOff: string; reminderLabel: string;
  reminderOn: string; reminderOff: string; ownerLabel: string; ownerOn: string; ownerOff: string;
  loadFailed: string; saveFailed: string; footnote: string;
}> = {
  en: {
    heading: 'Booking emails',
    confirmLabel: 'Confirm online bookings automatically',
    confirmOn: 'Pay-in-shop bookings are confirmed right away and the customer gets the confirmation email.',
    confirmOff: 'Bookings wait for you. The customer gets a "request received" email, then the confirmation when you confirm.',
    reminderLabel: 'Reminder the day before',
    reminderOn: 'Customers get a reminder email 24 hours before their appointment.',
    reminderOff: 'No reminder emails.',
    ownerLabel: 'Email me about bookings',
    ownerOn: 'You get an email for every new or cancelled online booking.',
    ownerOff: 'No emails to the shop about bookings.',
    loadFailed: 'Could not load these settings.', saveFailed: 'Could not save. Please try again.',
    footnote: 'Emails go out through the sender configured below. Without a sender, nothing is sent.',
  },
  de: {
    heading: 'Buchungs-E-Mails',
    confirmLabel: 'Online-Buchungen automatisch bestätigen',
    confirmOn: 'Buchungen mit Zahlung vor Ort werden sofort bestätigt, der Kunde erhält die Bestätigungs-E-Mail.',
    confirmOff: 'Buchungen warten auf Ihre Bestätigung. Der Kunde erhält zuerst eine E-Mail „Anfrage erhalten“, nach Ihrer Bestätigung dann die Bestätigung.',
    reminderLabel: 'Erinnerung am Vortag',
    reminderOn: 'Kunden erhalten 24 Stunden vor dem Termin eine Erinnerungs-E-Mail.',
    reminderOff: 'Keine Erinnerungs-E-Mails.',
    ownerLabel: 'E-Mail an mich bei Buchungen',
    ownerOn: 'Sie erhalten eine E-Mail zu jeder neuen oder stornierten Online-Buchung.',
    ownerOff: 'Keine E-Mails an den Shop zu Buchungen.',
    loadFailed: 'Einstellungen konnten nicht geladen werden.', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    footnote: 'E-Mails werden über den unten eingerichteten Absender verschickt. Ohne Absender wird nichts gesendet.',
  },
  th: {
    heading: 'อีเมลการจอง',
    confirmLabel: 'ยืนยันการจองออนไลน์อัตโนมัติ',
    confirmOn: 'การจองแบบชำระที่ร้านจะได้รับการยืนยันทันที และลูกค้าจะได้รับอีเมลยืนยัน',
    confirmOff: 'การจองจะรอให้คุณยืนยัน ลูกค้าจะได้รับอีเมล "ได้รับคำขอแล้ว" ก่อน แล้วจึงได้อีเมลยืนยันเมื่อคุณยืนยัน',
    reminderLabel: 'แจ้งเตือนล่วงหน้าหนึ่งวัน',
    reminderOn: 'ลูกค้าจะได้รับอีเมลแจ้งเตือน 24 ชั่วโมงก่อนนัดหมาย',
    reminderOff: 'ไม่ส่งอีเมลแจ้งเตือน',
    ownerLabel: 'ส่งอีเมลถึงฉันเมื่อมีการจอง',
    ownerOn: 'คุณจะได้รับอีเมลทุกครั้งที่มีการจองออนไลน์ใหม่หรือถูกยกเลิก',
    ownerOff: 'ไม่ส่งอีเมลเรื่องการจองถึงร้าน',
    loadFailed: 'โหลดการตั้งค่าไม่สำเร็จ', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    footnote: 'อีเมลจะส่งผ่านผู้ส่งที่ตั้งค่าไว้ด้านล่าง หากไม่มีผู้ส่ง จะไม่มีการส่งอีเมล',
  },
};

const ROWS: { key: SettingKey; label: TextKey; on: TextKey; off: TextKey }[] = [
  { key: 'booking_confirmation_mode', label: 'confirmLabel', on: 'confirmOn', off: 'confirmOff' },
  { key: 'send_booking_reminders', label: 'reminderLabel', on: 'reminderOn', off: 'reminderOff' },
  { key: 'notify_owner_bookings', label: 'ownerLabel', on: 'ownerOn', off: 'ownerOff' },
];

const isOn = (settings: NotificationSettings, key: SettingKey) =>
  key === 'booking_confirmation_mode' ? settings.booking_confirmation_mode === 'auto' : settings[key];

/** Booking emails: automatic confirmation, reminders, owner notifications. */
export default function BookingNotificationSettings() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [error, setError] = useState<'loadFailed' | 'saveFailed' | null>(null);

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
          setError('loadFailed');
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
      setError('saveFailed');
      return;
    }
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section aria-labelledby="booking-emails-heading" className="mb-8 rounded-2xl border border-stone-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <BellRing className="h-5 w-5 text-stone-600" aria-hidden="true" />
        <h3 id="booking-emails-heading" className="text-lg font-medium text-stone-900">{t.heading}</h3>
      </div>
      <ul className="divide-y divide-stone-100">
        {ROWS.map((row) => {
          const checked = isOn(settings, row.key);
          return (
            <li key={row.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p id={`${row.key}-label`} className="font-medium text-stone-900">{t[row.label]}</p>
                <p className="text-sm text-stone-500">{checked ? t[row.on] : t[row.off]}</p>
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
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{t[error]}</p>}
      <p className="mt-3 text-xs text-stone-400">
        {t.footnote}
      </p>
    </section>
  );
}
