import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../adminUi';
import CalendarModal from '../calendar/CalendarModal';
import type { ReceptionistText } from './receptionistText';

export interface FaqEntry { question: string; answer: string }

const MAX_FAQ = 30;

interface SaveProps {
  t: ReceptionistText;
  onClose: () => void;
  isSaving: boolean;
  error: string | null;
}

/** All question/answer entries in one popup; saved together. */
export function FaqModal({ entries, onSave, ...props }: SaveProps & { entries: FaqEntry[]; onSave: (entries: FaqEntry[]) => void }) {
  const { t } = props;
  const [items, setItems] = useState<FaqEntry[]>(entries.length ? entries : [{ question: '', answer: '' }]);
  const update = (index: number, field: keyof FaqEntry, value: string) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  const complete = items.filter((item) => item.question.trim() && item.answer.trim());

  return (
    <CalendarModal title={t.secFaq} subtitle={t.faqHint} closeLabel={t.close} onClose={props.onClose} maxWidthClass="max-w-2xl">
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <input value={item.question} onChange={(e) => update(index, 'question', e.target.value)} maxLength={200} placeholder={t.question} className={ADMIN_INPUT} />
              <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label={t.deleteEntry} title={t.deleteEntry}
                className="rounded-xl p-2.5 text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <textarea value={item.answer} onChange={(e) => update(index, 'answer', e.target.value)} rows={2} maxLength={600} placeholder={t.answer} className={ADMIN_INPUT} />
          </div>
        ))}
        {items.length < MAX_FAQ && (
          <button type="button" onClick={() => setItems((current) => [...current, { question: '', answer: '' }])} className={ADMIN_SECONDARY_BUTTON}>
            <Plus className="h-4 w-4" />{t.addQuestion}
          </button>
        )}
        {props.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{props.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
          <button type="button" disabled={props.isSaving} onClick={() => onSave(complete)} className={ADMIN_PRIMARY_BUTTON}>
            {props.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{t.save}
          </button>
        </div>
      </div>
    </CalendarModal>
  );
}

/** Assistant name + Sie/du. */
export function StyleModal({ name, addressForm, onSave, ...props }: SaveProps & {
  name: string; addressForm: 'sie' | 'du'; onSave: (name: string, addressForm: 'sie' | 'du') => void;
}) {
  const { t } = props;
  const [value, setValue] = useState(name);
  const [form, setForm] = useState(addressForm);
  const chip = (isActive: boolean) => `rounded-xl border px-4 py-3 text-sm font-medium ${isActive ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'}`;
  return (
    <CalendarModal title={t.secStyle} closeLabel={t.close} onClose={props.onClose}>
      <div className="space-y-4">
        <label className="block text-sm text-stone-600">{t.assistantName}
          <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} placeholder={t.noName} className={`${ADMIN_INPUT} mt-1`} />
          <span className="mt-1 block text-xs text-stone-400">{t.assistantNameHint}</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setForm('sie')} className={chip(form === 'sie')}>{t.formSie}</button>
          <button type="button" onClick={() => setForm('du')} className={chip(form === 'du')}>{t.formDu}</button>
        </div>
        {props.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{props.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={props.onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
          <button type="button" disabled={props.isSaving} onClick={() => onSave(value.trim(), form)} className={ADMIN_PRIMARY_BUTTON}>
            {props.isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{t.save}
          </button>
        </div>
      </div>
    </CalendarModal>
  );
}
