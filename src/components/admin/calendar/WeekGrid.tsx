import { isSameDay, visibleHourRange, weekDates } from './calendarModel';
import { bookingRange, columnBlocks, columnBookings, offRanges, shopOpenRange, visibleStaff } from './calendarColumns';
import TimeColumn, { HourGutter } from './TimeColumn';
import type { CalendarBlock, CalendarBooking, CalendarData } from './useCalendarData';
import type { CalendarText } from './calendarText';

interface WeekGridProps {
  anchor: Date;
  data: CalendarData;
  staffFilter: string | null;
  t: CalendarText;
  locale: string;
  onSlot: (day: Date, minutes: number, specialistId: string | null) => void;
  onBooking: (booking: CalendarBooking) => void;
  onBlock: (block: CalendarBlock) => void;
  onOpenDay: (day: Date) => void;
}

/** Monday to Sunday, appointments coloured by therapist. */
export default function WeekGrid(props: WeekGridProps) {
  const { data, staffFilter, t, locale } = props;
  const days = weekDates(props.anchor);
  const staffIds = visibleStaff(data.staff, data.bookings, staffFilter).map((s) => s.id);
  const allStaffIds = data.staff.map((s) => s.id);
  const filterIds = staffFilter === null ? null : staffIds;
  const openByDay = days.map((day) => shopOpenRange(data.workingHours, staffIds, day));
  const { startHour, endHour } = visibleHourRange(
    openByDay.filter((r) => r !== null) as { startMin: number; endMin: number }[],
    data.bookings.map(bookingRange),
  );
  const today = new Date();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="sticky top-0 z-40 flex border-b border-stone-200 bg-[#F7F5F2]/95 backdrop-blur">
          <div className="w-14 shrink-0" />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => props.onOpenDay(day)}
                className="flex flex-1 flex-col items-center border-l border-stone-200/80 py-2 hover:bg-white/70"
              >
                <span className="text-[12px] font-medium uppercase tracking-wide text-stone-500">
                  {day.toLocaleDateString(locale, { weekday: 'short' })}
                </span>
                <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums ${isToday ? 'bg-[#1A1714] text-white' : 'text-[#1A1714]'}`}>
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex">
          <HourGutter startHour={startHour} endHour={endHour} />
          {days.map((day, i) => (
            <div key={day.toISOString()} className="flex-1">
              <TimeColumn
                startHour={startHour}
                endHour={endHour}
                offRanges={offRanges(openByDay[i], startHour, endHour)}
                blocks={columnBlocks(data.blocks, day, filterIds)}
                bookings={columnBookings(data.bookings, day, filterIds, allStaffIds, data.staffNotes)}
                isToday={isSameDay(day, today)}
                t={t}
                label={day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                onEmptyClick={(minutes) => props.onSlot(day, minutes, staffFilter)}
                onBookingClick={props.onBooking}
                onBlockClick={props.onBlock}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
