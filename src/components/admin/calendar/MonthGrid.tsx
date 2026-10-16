import { isSameDay, monthCells, weekDates } from './calendarModel';
import { toLocalDateString } from '../../../lib/localDateTime';
import { fillText } from '../../../lib/bookingLanguage';
import type { CalendarData } from './useCalendarData';
import type { CalendarText } from './calendarText';

interface MonthGridProps {
  anchor: Date;
  data: CalendarData;
  staffFilter: string | null;
  t: CalendarText;
  locale: string;
  onOpenDay: (day: Date) => void;
}

/** Month overview: number of appointments per day; a click opens that day. */
export default function MonthGrid({ anchor, data, staffFilter, t, locale, onOpenDay }: MonthGridProps) {
  const today = new Date();
  const counts = new Map<string, number>();
  data.bookings
    .filter((b) => staffFilter === null || b.specialist_id === staffFilter || b.partner_specialist_id === staffFilter)
    .forEach((b) => counts.set(b.booking_date, (counts.get(b.booking_date) ?? 0) + 1));
  const hasClosure = (day: Date) => data.blocks.some((block) => {
    if (block.specialist_id !== null) return false;
    const start = new Date(block.start_time);
    const end = new Date(block.end_time);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return start < dayEnd && end > dayStart;
  });

  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1.5">
        {weekDates(today).map((day) => (
          <div key={day.getDay()} className="pb-1 text-center text-[12px] font-semibold uppercase tracking-wide text-stone-400">
            {day.toLocaleDateString(locale, { weekday: 'short' })}
          </div>
        ))}
        {monthCells(anchor).map((day, index) => {
          if (!day) return <div key={`pad-${index}`} />;
          const count = counts.get(toLocalDateString(day)) ?? 0;
          const isToday = isSameDay(day, today);
          const isClosed = hasClosure(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onOpenDay(day)}
              className={`flex min-h-[76px] flex-col items-start rounded-xl border p-2 text-left transition hover:border-stone-400 hover:bg-white ${isToday ? 'border-[#1A1714] bg-white' : 'border-stone-200/80 bg-white/60'}`}
              style={isClosed ? { background: 'repeating-linear-gradient(135deg, #FAFAF9 0 8px, #F0EEEC 8px 16px)' } : undefined}
            >
              <span className={`text-sm font-semibold tabular-nums ${isToday ? 'text-[#1A1714]' : 'text-stone-600'}`}>{day.getDate()}</span>
              {isClosed && <span className="text-[11px] text-stone-500">{t.shopClosed}</span>}
              {count > 0 && (
                <span className="mt-auto rounded-md bg-stone-900/[0.07] px-1.5 py-0.5 text-[12px] font-medium text-stone-700">
                  {count === 1 ? t.appointmentsOne : fillText(t.appointmentsMany, { count })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
