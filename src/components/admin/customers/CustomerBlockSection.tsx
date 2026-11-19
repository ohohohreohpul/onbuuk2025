import { useState } from 'react';
import { Ban, Loader2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../adminUi';

const TEXT: Translations<{
  blockedSince: string; noReason: string; unblock: string; block: string; title: string; close: string;
  explain: string; reason: string; reasonPlaceholder: string; reasonHint: string; cancel: string; confirm: string;
  saving: string; failed: string;
}> = {
  en: {
    blockedSince: 'Blocked from online booking since {date}', noReason: 'No reason noted.', unblock: 'Unblock',
    block: 'Block online booking', title: 'Block online booking', close: 'Close',
    explain: '{name} can no longer book online, by chat or through AI assistants. They only see “Online booking is not possible, please contact the shop”. Your team can still book them by hand.',
    reason: 'Reason (only your team sees this)', reasonPlaceholder: 'e.g. 3 no-shows without notice',
    reasonHint: 'Write facts only. The customer may ask to see what is stored about them.',
    cancel: 'Cancel', confirm: 'Block', saving: 'Saving…', failed: 'Could not save. Please try again.',
  },
  de: {
    blockedSince: 'Für Online-Buchungen gesperrt seit {date}', noReason: 'Kein Grund notiert.', unblock: 'Sperre aufheben',
    block: 'Online-Buchung sperren', title: 'Online-Buchung sperren', close: 'Schließen',
    explain: '{name} kann nicht mehr online, per Chat oder über KI-Assistenten buchen. Angezeigt wird nur „Eine Online-Buchung ist nicht möglich, bitte wenden Sie sich an das Geschäft“. Ihr Team kann weiterhin von Hand buchen.',
    reason: 'Grund (sieht nur Ihr Team)', reasonPlaceholder: 'z. B. 3 No-Shows ohne Absage',
    reasonHint: 'Nur Fakten notieren. Kund:innen dürfen erfragen, was über sie gespeichert ist.',
    cancel: 'Abbrechen', confirm: 'Sperren', saving: 'Wird gespeichert…', failed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  },
  th: {
    blockedSince: 'ระงับการจองออนไลน์ตั้งแต่ {date}', noReason: 'ไม่ได้ระบุเหตุผล', unblock: 'ยกเลิกการระงับ',
    block: 'ระงับการจองออนไลน์', title: 'ระงับการจองออนไลน์', close: 'ปิด',
    explain: '{name} จะจองออนไลน์ ผ่านแชท หรือผ่านผู้ช่วย AI ไม่ได้อีก ลูกค้าจะเห็นเพียง “ไม่สามารถจองออนไลน์ได้ กรุณาติดต่อร้าน” ทีมของคุณยังจองให้ได้ตามปกติ',
    reason: 'เหตุผล (เห็นเฉพาะทีมของคุณ)', reasonPlaceholder: 'เช่น ไม่มาตามนัด 3 ครั้งโดยไม่แจ้ง',
    reasonHint: 'เขียนเฉพาะข้อเท็จจริง ลูกค้ามีสิทธิ์ขอดูข้อมูลที่บันทึกเกี่ยวกับตน',
    cancel: 'ยกเลิก', confirm: 'ระงับ', saving: 'กำลังบันทึก…', failed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
};

export interface BlockableCustomer {
  id: string;
  name: string;
  blocked_at?: string | null;
  blocked_reason?: string | null;
}

interface CustomerBlockSectionProps {
  customer: BlockableCustomer;
  onChanged: () => void;
}

const germanDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');

/** Block banner (with Unblock) or the "Block online booking" button, plus its popup. */
export default function CustomerBlockSection({ customer, onChanged }: CustomerBlockSectionProps) {
  const { t } = useAdminText(TEXT);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (isBlocked: boolean) => {
    setIsSaving(true);
    setError(null);
    const { error: saveError } = await supabase.rpc('set_customer_blocked', {
      p_customer_id: customer.id, p_blocked: isBlocked, p_reason: isBlocked ? reason : null,
    });
    setIsSaving(false);
    if (saveError) {
      console.error('Could not change block:', saveError);
      setError(t.failed);
      return;
    }
    setIsOpen(false);
    setReason('');
    onChanged();
  };

  if (customer.blocked_at) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-b border-red-100 bg-red-50 px-6 py-3">
        <Ban className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-red-800">{fillText(t.blockedSince, { date: germanDate(customer.blocked_at) })}</p>
          <p className="text-red-700">{customer.blocked_reason || t.noReason}</p>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" className={ADMIN_SECONDARY_BUTTON} disabled={isSaving} onClick={() => save(false)}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />} {t.unblock}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end border-b border-stone-100 px-6 py-2">
        <button type="button" onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50">
          <Ban className="h-4 w-4" aria-hidden="true" /> {t.block}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A1714]/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="block-title">
          <div className="relative w-full max-w-md rounded-3xl bg-[#F7F5F2] p-7 shadow-[0_24px_80px_rgba(26,23,20,0.35)]">
            <button type="button" onClick={() => setIsOpen(false)} aria-label={t.close}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-900/5 hover:text-stone-700">
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-red-700 text-white">
              <Ban className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h2 id="block-title" className="text-[22px] font-semibold leading-tight tracking-tight text-[#1A1714]">{t.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{fillText(t.explain, { name: customer.name })}</p>

            <label htmlFor="block-reason" className="mt-5 block text-sm">
              <span className="font-medium text-stone-700">{t.reason}</span>
              <textarea id="block-reason" rows={3} maxLength={500} className={`${ADMIN_INPUT} mt-1 bg-white`} value={reason}
                placeholder={t.reasonPlaceholder} disabled={isSaving} onChange={(e) => setReason(e.target.value)} />
              <span className="mt-1 block text-xs text-stone-500">{t.reasonHint}</span>
            </label>

            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSaving}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-stone-900/5 hover:text-stone-700">
                {t.cancel}
              </button>
              <button type="button" className={`${ADMIN_PRIMARY_BUTTON} !bg-red-700 hover:!bg-red-800`} disabled={isSaving} onClick={() => save(true)}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}
                {isSaving ? t.saving : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
