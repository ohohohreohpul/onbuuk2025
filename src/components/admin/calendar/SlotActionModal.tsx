import { CalendarPlus, Ban, LucideIcon } from 'lucide-react';
import { fillText } from '../../../lib/bookingLanguage';
import CalendarModal from './CalendarModal';
import type { CalendarText } from './calendarText';

interface SlotActionModalProps {
  dateLabel: string;
  time: string;
  staffName: string | null;
  t: CalendarText;
  onBook: () => void;
  onBlock: () => void;
  onClose: () => void;
}

function BigChoice({ icon: Icon, title, hint, onClick }: { icon: LucideIcon; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-400 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-stone-900/10"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]">
        <Icon className="h-6 w-6" />
      </span>
      <span>
        <span className="block text-base font-semibold text-[#1A1714]">{title}</span>
        <span className="block text-sm text-stone-500">{hint}</span>
      </span>
    </button>
  );
}

/** Click on an empty spot: two big, plainly worded choices. */
export default function SlotActionModal({ dateLabel, time, staffName, t, onBook, onBlock, onClose }: SlotActionModalProps) {
  const title = fillText(t.slotTitle, { date: dateLabel, time });
  return (
    <CalendarModal title={title} subtitle={staffName ? `${staffName} · ${t.slotQuestion}` : t.slotQuestion} closeLabel={t.close} onClose={onClose}>
      <div className="space-y-3">
        <BigChoice icon={CalendarPlus} title={t.slotBook} hint={t.slotBookHint} onClick={onBook} />
        <BigChoice icon={Ban} title={t.slotBlock} hint={t.slotBlockHint} onClick={onBlock} />
      </div>
    </CalendarModal>
  );
}
