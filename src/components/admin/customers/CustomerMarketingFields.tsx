import { useEffect, useState } from 'react';
import { Cake, Mail } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { isValidBirthday } from '../../../lib/customerDetails';

type NewsletterStatus = 'pending' | 'subscribed' | 'unsubscribed' | null;

const TEXT: Translations<{
  birthday: string; save: string; saved: string; invalid: string; failed: string; newsletter: string;
  subscribed: string; pending: string; unsubscribed: string; existing: string; unsubscribe: string; confirmUnsubscribe: string;
}> = {
  en: {
    birthday: 'Birthday', save: 'Save', saved: 'Saved', invalid: 'Please enter a valid date', failed: 'Could not save',
    newsletter: 'Promotion emails', subscribed: 'Subscribed to the newsletter', pending: 'Waiting for email confirmation',
    unsubscribed: 'Unsubscribed', existing: 'Existing customer (no newsletter sign-up)', unsubscribe: 'Unsubscribe',
    confirmUnsubscribe: 'Stop all promotion emails to this customer?',
  },
  de: {
    birthday: 'Geburtstag', save: 'Speichern', saved: 'Gespeichert', invalid: 'Bitte ein gültiges Datum eingeben', failed: 'Speichern fehlgeschlagen',
    newsletter: 'Werbe-E-Mails', subscribed: 'Newsletter abonniert', pending: 'Wartet auf Bestätigung per E-Mail',
    unsubscribed: 'Abgemeldet', existing: 'Bestandskunde (kein Newsletter-Abo)', unsubscribe: 'Abmelden',
    confirmUnsubscribe: 'Keine Werbe-E-Mails mehr an diesen Kunden senden?',
  },
  th: {
    birthday: 'วันเกิด', save: 'บันทึก', saved: 'บันทึกแล้ว', invalid: 'กรุณากรอกวันที่ที่ถูกต้อง', failed: 'บันทึกไม่สำเร็จ',
    newsletter: 'อีเมลโปรโมชัน', subscribed: 'สมัครรับข่าวสารแล้ว', pending: 'รอยืนยันทางอีเมล',
    unsubscribed: 'ยกเลิกรับแล้ว', existing: 'ลูกค้าเดิม (ไม่ได้สมัครรับข่าวสาร)', unsubscribe: 'ยกเลิกรับ',
    confirmUnsubscribe: 'หยุดส่งอีเมลโปรโมชันถึงลูกค้ารายนี้?',
  },
};

/** Birthday (editable) and promotion-email status for the customer profile. */
export default function CustomerMarketingFields({ customerId }: { customerId: string }) {
  const { t } = useAdminText(TEXT);
  const [birthday, setBirthday] = useState('');
  const [savedBirthday, setSavedBirthday] = useState('');
  const [status, setStatus] = useState<NewsletterStatus>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    supabase.from('customers').select('birthday, newsletter_status').eq('id', customerId).maybeSingle()
      .then(({ data, error }) => {
        if (!isCurrent) return;
        if (error) {
          console.error('Could not load customer marketing fields:', error);
          return;
        }
        setBirthday(data?.birthday ?? '');
        setSavedBirthday(data?.birthday ?? '');
        setStatus((data?.newsletter_status ?? null) as NewsletterStatus);
      });
    return () => { isCurrent = false; };
  }, [customerId]);

  const update = async (patch: Record<string, unknown>, okText: string): Promise<boolean> => {
    setBusy(true);
    const { error } = await supabase.from('customers').update(patch).eq('id', customerId);
    setBusy(false);
    if (error) {
      console.error('Could not update customer:', error);
      setNotice({ tone: 'error', text: t.failed });
      return false;
    }
    setNotice({ tone: 'ok', text: okText });
    return true;
  };

  const saveBirthday = async () => {
    if (birthday && !isValidBirthday(birthday)) {
      setNotice({ tone: 'error', text: t.invalid });
      return;
    }
    if (await update({ birthday: birthday || null }, t.saved)) setSavedBirthday(birthday);
  };

  const unsubscribe = async () => {
    if (!confirm(t.confirmUnsubscribe)) return;
    if (await update({ newsletter_status: 'unsubscribed', newsletter_changed_at: new Date().toISOString() }, t.saved)) setStatus('unsubscribed');
  };

  const statusText = status === 'subscribed' ? t.subscribed : status === 'pending' ? t.pending : status === 'unsubscribed' ? t.unsubscribed : t.existing;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="customer-birthday" className="mb-1 flex items-center space-x-2 text-sm text-stone-600">
          <Cake className="h-4 w-4" /><span>{t.birthday}</span>
        </label>
        <div className="flex gap-2">
          <input
            id="customer-birthday"
            type="date"
            value={birthday}
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBirthday(e.target.value)}
            className="flex-1 rounded border border-stone-200 px-3 py-2 focus:border-stone-800 focus:outline-none"
          />
          {birthday !== savedBirthday && (
            <button type="button" onClick={saveBirthday} disabled={busy} className="rounded bg-stone-800 px-3 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50">
              {t.save}
            </button>
          )}
        </div>
      </div>
      <div>
        <span className="mb-1 flex items-center space-x-2 text-sm text-stone-600"><Mail className="h-4 w-4" /><span>{t.newsletter}</span></span>
        <div className="flex items-center justify-between gap-2 py-2">
          <span className="text-sm text-stone-800">{statusText}</span>
          {status !== 'unsubscribed' && (
            <button type="button" onClick={unsubscribe} disabled={busy} className="text-sm text-red-700 hover:underline disabled:opacity-50">{t.unsubscribe}</button>
          )}
        </div>
      </div>
      {notice && (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`md:col-span-2 text-sm ${notice.tone === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{notice.text}</p>
      )}
    </div>
  );
}
