import { useState } from 'react';
import { CalendarCheck, Loader2, Store, Trash2 } from 'lucide-react';
import { fillText } from '../../../lib/bookingLanguage';
import { supabase } from '../../../lib/supabase';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../adminUi';
import CalendarModal from './CalendarModal';
import { BLOCK_COLORS, addDays } from './calendarModel';
import type { CalendarBlock, CalendarStaff } from './useCalendarData';
import { BlockDraft, BlockOwner, draftFromBlock } from './blockDraft';
import type { CalendarText } from './calendarText';


interface BlockTimeModalProps {
  businessId: string;
  staff: CalendarStaff[];
  draft: BlockDraft;
  existing: CalendarBlock | null;
  t: CalendarText;
  onSaved: () => void;
  onClose: () => void;
  /** Existing block only: make a real appointment out of a quick reservation. */
  onConvert?: (block: CalendarBlock) => void;
}

const DAY_START = '00:00';
const atLocal = (day: string, time: string) => new Date(`${day}T${time}:00`);

/** Block a therapist (or close the shop): who, when, why. */
export default function BlockTimeModal({ businessId, staff, draft, existing, t, onSaved, onClose, onConvert }: BlockTimeModalProps) {
  const initial = existing ? draftFromBlock(existing) : { ...draft, lastDay: draft.date, isWholeDay: false };
  const [owner, setOwner] = useState<BlockOwner>(initial.owner);
  const [date, setDate] = useState(initial.date);
  const [lastDay, setLastDay] = useState(initial.lastDay);
  const [isSeveralDays, setIsSeveralDays] = useState(initial.lastDay !== initial.date);
  const [isWholeDay, setIsWholeDay] = useState(initial.isWholeDay);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const presetReasons = [t.reasonBreak, t.reasonHoliday, t.reasonSick, t.reasonAppointment, t.reasonClosed];
  const [comment, setComment] = useState(existing?.reason ?? '');
  const [color, setColor] = useState<string | null>(existing?.color ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = () => {
    const finalDay = isSeveralDays ? lastDay : date;
    if (isWholeDay) {
      return { from: atLocal(date, DAY_START), to: addDays(atLocal(finalDay, DAY_START), 1) };
    }
    return { from: atLocal(date, start), to: atLocal(finalDay, end) };
  };

  const minutesBlocked = Math.round((range().to.getTime() - range().from.getTime()) / 60_000);
  const durationLabel = minutesBlocked > 0
    ? fillText(t.durationLabel, { hours: Math.floor(minutesBlocked / 60), minutes: minutesBlocked % 60 })
    : '';

  const save = async () => {
    setError(null);
    if (owner === null) { setError(t.errorWho); return; }
    const { from, to } = range();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) { setError(t.errorRange); return; }
    setIsSaving(true);
    const row = {
      business_id: businessId,
      specialist_id: owner === 'shop' ? null : owner,
      start_time: from.toISOString(),
      end_time: to.toISOString(),
      reason: comment.trim() || null,
      color,
    };
    const { error: saveError } = existing
      ? await supabase.from('time_blocks').update(row).eq('id', existing.id)
      : await supabase.from('time_blocks').insert(row);
    setIsSaving(false);
    if (saveError) {
      console.error('Could not save blocked time:', saveError);
      setError(t.errorSave);
      return;
    }
    onSaved();
  };

  const remove = async () => {
    if (!existing) return;
    setIsSaving(true);
    const { error: deleteError } = await supabase.from('time_blocks').delete().eq('id', existing.id);
    setIsSaving(false);
    if (deleteError) {
      console.error('Could not remove blocked time:', deleteError);
      setError(t.errorDelete);
      return;
    }
    onSaved();
  };

  const chip = (isActive: boolean) =>
    `rounded-xl border px-3.5 py-2 text-sm font-medium transition ${isActive ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'}`;

  return (
    <CalendarModal title={existing ? t.blockEditTitle : t.blockTitle} closeLabel={t.close} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[#1A1714]">{t.who}</h3>
          <div className="flex flex-wrap gap-2">
            {staff.filter((s) => s.is_active).map((s) => (
              <button key={s.id} type="button" onClick={() => setOwner(s.id)} className={chip(owner === s.id)}>{s.name}</button>
            ))}
            <button type="button" onClick={() => setOwner('shop')} className={`${chip(owner === 'shop')} inline-flex items-center gap-1.5`}>
              <Store className="h-4 w-4" />{t.wholeShop}
            </button>
          </div>
          {owner === 'shop' && <p className="mt-2 text-sm text-amber-700">{t.wholeShopHint}</p>}
        </section>

        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-stone-600">{t.date}
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (lastDay < e.target.value) setLastDay(e.target.value); }} className={`${ADMIN_INPUT} mt-1`} />
            </label>
            {isSeveralDays && (
              <label className="block text-sm text-stone-600">{t.lastDay}
                <input type="date" value={lastDay} min={date} onChange={(e) => setLastDay(e.target.value)} className={`${ADMIN_INPUT} mt-1`} />
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-700">
            <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={isWholeDay} onChange={(e) => setIsWholeDay(e.target.checked)} />{t.wholeDay}</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={isSeveralDays} onChange={(e) => setIsSeveralDays(e.target.checked)} />{t.severalDays}</label>
          </div>
          {!isWholeDay && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-stone-600">{t.from}
                <input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className={`${ADMIN_INPUT} mt-1`} />
              </label>
              <label className="block text-sm text-stone-600">{t.until}
                <input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className={`${ADMIN_INPUT} mt-1`} />
              </label>
              {durationLabel && <p className="col-span-2 text-sm text-stone-500">{durationLabel}</p>}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-[#1A1714]">{t.comment}</h3>
          <div className="mb-2 flex flex-wrap gap-2">
            {presetReasons.map((label) => (
              <button key={label} type="button" onClick={() => setComment(label)} className={chip(comment === label)}>{label}</button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t.commentPlaceholder}
            className={ADMIN_INPUT}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t.color}>
            <button type="button" role="radio" aria-checked={color === null} aria-label={t.noColor} onClick={() => setColor(null)}
              className={`h-9 w-9 rounded-full border-2 bg-stone-300 ${color === null ? 'border-[#1A1714] ring-2 ring-white' : 'border-transparent'}`} />
            {BLOCK_COLORS.map((swatch) => (
              <button key={swatch} type="button" role="radio" aria-checked={color === swatch} aria-label={swatch} onClick={() => setColor(swatch)}
                className={`h-9 w-9 rounded-full border-2 ${color === swatch ? 'border-[#1A1714] ring-2 ring-white' : 'border-transparent'}`}
                style={{ background: swatch }} />
            ))}
          </div>
        </section>

        {existing && onConvert && existing.specialist_id && (
          <button type="button" onClick={() => onConvert(existing)} className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left hover:border-emerald-400">
            <CalendarCheck className="h-6 w-6 shrink-0 text-emerald-700" />
            <span>
              <span className="block font-semibold text-emerald-900">{t.convert}</span>
              <span className="block text-sm text-emerald-800">{t.convertHint}</span>
            </span>
          </button>
        )}

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {existing ? (
            isConfirmingDelete ? (
              <button type="button" onClick={remove} disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" />{t.confirmDelete}
              </button>
            ) : (
              <button type="button" onClick={() => setIsConfirmingDelete(true)} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />{t.deleteBlock}
              </button>
            )
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
            <button type="button" onClick={save} disabled={isSaving} className={ADMIN_PRIMARY_BUTTON}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isSaving ? t.saving : t.save}
            </button>
          </div>
        </div>
        {isConfirmingDelete && <p className="text-sm text-stone-500">{t.deleteConfirm}</p>}
      </div>
    </CalendarModal>
  );
}
