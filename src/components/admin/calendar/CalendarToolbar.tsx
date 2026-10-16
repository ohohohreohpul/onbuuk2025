import { Ban, CalendarPlus, ChevronLeft, ChevronRight, Gift, Ticket } from 'lucide-react';
import {
  ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SEGMENTED_CONTROL, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE,
} from '../adminUi';
import type { CalendarText } from './calendarText';
import type { CalendarStaff } from './useCalendarData';
import { staffColor } from './calendarModel';

export type CalendarMode = 'day' | 'week' | 'month';

interface CalendarToolbarProps {
  title: string;
  mode: CalendarMode;
  staff: CalendarStaff[];
  staffFilter: string | null;
  canSellVouchers: boolean;
  t: CalendarText;
  onMode: (mode: CalendarMode) => void;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
  onStaffFilter: (id: string | null) => void;
  onNewBooking: () => void;
  onBlockTime: () => void;
  onRedeemVoucher: () => void;
  onSellVoucher: () => void;
}

/** Date navigation, view switch, the four everyday actions and the therapist filter. */
export default function CalendarToolbar(props: CalendarToolbarProps) {
  const { t, mode } = props;
  const modes: { id: CalendarMode; label: string }[] = [
    { id: 'day', label: t.viewDay }, { id: 'week', label: t.viewWeek }, { id: 'month', label: t.viewMonth },
  ];
  const activeStaff = props.staff.filter((s) => s.is_active);
  const allIds = props.staff.map((s) => s.id);
  const filterChip = (isActive: boolean) =>
    `inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${isActive ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 bg-white/70 text-stone-600 hover:border-stone-400'}`;

  const actionButton = `${ADMIN_SECONDARY_BUTTON} shrink-0 py-2.5 sm:py-3 sm:text-[15px]`;
  const navButton = 'rounded-xl border border-stone-200 bg-white/80 p-2.5 text-stone-700 hover:border-stone-400';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={() => props.onStep(-1)} aria-label={t.previous} title={t.previous} className={navButton}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={props.onToday} className="rounded-xl border border-stone-200 bg-white/80 px-3 py-2.5 text-sm font-semibold text-stone-700 hover:border-stone-400 sm:px-4">
            {t.today}
          </button>
          <button type="button" onClick={() => props.onStep(1)} aria-label={t.next} title={t.next} className={navButton}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <h1 className="ml-1 truncate text-base font-semibold tracking-tight text-[#1A1714] sm:ml-2 sm:text-xl">{props.title}</h1>
        </div>
        <div className={ADMIN_SEGMENTED_CONTROL} role="tablist">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => props.onMode(m.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === m.id ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" onClick={props.onNewBooking} className={`${ADMIN_PRIMARY_BUTTON} shrink-0 py-2.5 sm:py-3 sm:text-[15px]`}>
          <CalendarPlus className="h-5 w-5" />{t.newBooking}
        </button>
        <button type="button" onClick={props.onBlockTime} className={actionButton}>
          <Ban className="h-5 w-5" />{t.blockTime}
        </button>
        <button type="button" onClick={props.onRedeemVoucher} className={actionButton}>
          <Ticket className="h-5 w-5" />{t.redeemVoucher}
        </button>
        {props.canSellVouchers && (
          <button type="button" onClick={props.onSellVoucher} className={actionButton}>
            <Gift className="h-5 w-5" />{t.sellVoucher}
          </button>
        )}
      </div>

      {activeStaff.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label={t.showStaff}>
          <button type="button" onClick={() => props.onStaffFilter(null)} className={filterChip(props.staffFilter === null)}>{t.everyone}</button>
          {activeStaff.map((s) => (
            <button key={s.id} type="button" onClick={() => props.onStaffFilter(props.staffFilter === s.id ? null : s.id)} className={filterChip(props.staffFilter === s.id)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: staffColor(allIds, s.id).border }} />{s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
