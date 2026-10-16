import { useEffect, useState } from 'react';
import { Check, Loader2, StickyNote } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_SECONDARY_BUTTON } from '../adminUi';

const MAX_NOTE_LENGTH = 2000;

const TEXT: Translations<{ title: string; placeholder: string; hint: string; save: string; saved: string; failed: string }> = {
  en: { title: 'Note for the team', placeholder: 'e.g. wants Nann, strong pressure, back & neck', hint: 'Only your team sees this – never the customer.', save: 'Save note', saved: 'Saved', failed: 'Could not save the note.' },
  de: { title: 'Notiz fürs Team', placeholder: 'z. B. möchte zu Nann, kräftiger Druck, Rücken/Nacken', hint: 'Sieht nur Ihr Team – nie die Kundin / der Kunde.', save: 'Notiz speichern', saved: 'Gespeichert', failed: 'Notiz konnte nicht gespeichert werden.' },
  th: { title: 'โน้ตสำหรับทีม', placeholder: 'เช่น อยากได้พี่นันท์ กดแรง หลัง/คอ', hint: 'เห็นเฉพาะทีมของคุณ ลูกค้าไม่เห็น', save: 'บันทึกโน้ต', saved: 'บันทึกแล้ว', failed: 'บันทึกโน้ตไม่สำเร็จ' },
};

interface StaffNoteEditorProps {
  bookingId: string;
  businessId: string;
  /** Customer's own note from the booking form, shown read-only above. */
  customerNote?: string | null;
  onSaved: () => void;
}

/** Internal note on an appointment (booking_staff_notes), e.g. which therapist the caller asked for. */
export default function StaffNoteEditor({ bookingId, businessId, customerNote, onSaved }: StaffNoteEditorProps) {
  const { t } = useAdminText(TEXT);
  const [savedNote, setSavedNote] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  useEffect(() => {
    let isCancelled = false;
    supabase.from('booking_staff_notes').select('note').eq('booking_id', bookingId).maybeSingle()
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error) console.error('Could not load team note:', error);
        setSavedNote(data?.note ?? '');
        setNote(data?.note ?? '');
      });
    return () => { isCancelled = true; };
  }, [bookingId]);

  const save = async () => {
    setState('saving');
    const text = note.trim();
    const { error } = text
      ? await supabase.from('booking_staff_notes').upsert({ booking_id: bookingId, business_id: businessId, note: text, updated_at: new Date().toISOString() })
      : await supabase.from('booking_staff_notes').delete().eq('booking_id', bookingId);
    if (error) {
      console.error('Could not save team note:', error);
      setState('failed');
      return;
    }
    setSavedNote(text);
    setState('saved');
    onSaved();
  };

  const isChanged = note.trim() !== savedNote;

  return (
    <section className="rounded-2xl bg-[#F7F5F2] p-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#1A1714]"><StickyNote className="h-4 w-4" />{t.title}</h3>
      {customerNote && <p className="mb-2 whitespace-pre-line rounded-xl bg-white px-3 py-2 text-sm italic text-stone-600">„{customerNote}“</p>}
      <textarea value={note} onChange={(e) => { setNote(e.target.value); setState('idle'); }} rows={3} maxLength={MAX_NOTE_LENGTH} placeholder={t.placeholder} className={ADMIN_INPUT} />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-stone-400">{state === 'failed' ? <span className="text-red-600">{t.failed}</span> : t.hint}</span>
        {state === 'saved' && !isChanged ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" />{t.saved}</span>
        ) : (
          <button type="button" onClick={save} disabled={!isChanged || state === 'saving'} className={ADMIN_SECONDARY_BUTTON}>
            {state === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}{t.save}
          </button>
        )}
      </div>
    </section>
  );
}
