import { useEffect, useState } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import {
  SPECIALIST_CHOICE_KEY,
  isSpecialistChoiceAllowed,
  serializeSpecialistChoice,
} from '../../lib/specialistChoice';
import { useAdminText } from '../../lib/adminLanguage';
import type { Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{ title: string; allowedHelp: string; assignedHelp: string; loadFailed: string; saveFailed: string }> = {
  en: {
    title: 'Customers choose their therapist', allowedHelp: 'The booking page asks who should do the treatment.',
    assignedHelp: 'The booking page skips this step. Every online booking goes to a free therapist on shift; you can reassign it later.',
    loadFailed: 'Could not load this setting.', saveFailed: 'Could not save. Please try again.',
  },
  de: {
    title: 'Kunden wählen ihre Therapeut:in', allowedHelp: 'Die Buchungsseite fragt, wer die Behandlung durchführen soll.',
    assignedHelp: 'Die Buchungsseite überspringt diesen Schritt. Jede Online-Buchung geht an eine freie Therapeut:in im Dienst; Sie können sie später neu zuweisen.',
    loadFailed: 'Einstellung konnte nicht geladen werden.', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  },
  th: {
    title: 'ลูกค้าเลือกพนักงานบริการเอง', allowedHelp: 'หน้าจองจะถามว่าต้องการให้ใครเป็นผู้ให้บริการ',
    assignedHelp: 'หน้าจองจะข้ามขั้นตอนนี้ การจองออนไลน์ทุกรายการจะไปที่พนักงานบริการที่ว่างในกะ และเปลี่ยนผู้รับผิดชอบได้ภายหลัง',
    loadFailed: 'โหลดการตั้งค่านี้ไม่สำเร็จ', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
};

/** Switch: do customers pick their therapist online, or does the shop assign staff? */
export default function SpecialistChoiceSetting() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const [isAllowed, setIsAllowed] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<'loadFailed' | 'saveFailed' | null>(null);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('site_settings')
      .select('value')
      .eq('business_id', businessId)
      .eq('key', SPECIALIST_CHOICE_KEY)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (loadError) {
          console.error('Could not load the therapist choice setting:', loadError);
          setError('loadFailed');
        }
        setIsAllowed(isSpecialistChoiceAllowed(data?.value));
        setIsLoading(false);
      });
  }, [businessId]);

  const toggle = async () => {
    if (!businessId) return;
    const next = !isAllowed;
    setIsSaving(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('site_settings')
      .upsert(
        { business_id: businessId, key: SPECIALIST_CHOICE_KEY, value: serializeSpecialistChoice(next), category: 'booking' },
        { onConflict: 'business_id,key' },
      );
    setIsSaving(false);
    if (saveError) {
      console.error('Could not save the therapist choice setting:', saveError);
      setError('saveFailed');
      return;
    }
    setIsAllowed(next);
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
      <div className="flex min-w-0 items-start gap-3">
        <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-stone-600" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="specialist-choice-label" className="font-medium text-[#1A1714]">{t.title}</h2>
          <p className="text-sm text-stone-500">
            {isAllowed
              ? t.allowedHelp
              : t.assignedHelp}
          </p>
          {error && <p role="alert" className="mt-1 text-sm text-red-600">{t[error]}</p>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isAllowed}
        aria-labelledby="specialist-choice-label"
        disabled={isLoading || isSaving}
        onClick={toggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 disabled:opacity-60 ${isAllowed ? 'bg-[#1A1714]' : 'bg-stone-300'}`}
      >
        {isSaving ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-white" aria-hidden="true" />
        ) : (
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${isAllowed ? 'translate-x-6' : 'translate-x-1'}`} />
        )}
      </button>
    </section>
  );
}
