import { isSameDay, visibleHourRange, staffColor } from './calendarModel';
import { bookingRange, columnBlocks, columnBookings, offRanges, visibleStaff, workRange } from './calendarColumns';
import TimeColumn, { HourGutter } from './TimeColumn';
import type { CalendarBlock, CalendarBooking, CalendarData } from './useCalendarData';
import type { CalendarText } from './calendarText';
import { toLocalDateString } from '../../../lib/localDateTime';

interface DayGridProps {
  day: Date;
  data: CalendarData;
  staffFilter: string | null;
  t: CalendarText;
  onSlot: (day: Date, minutes: number, specialistId: string | null) => void;
  onBooking: (booking: CalendarBooking) => void;
  onBlock: (block: CalendarBlock) => void;
}

/** One day, one column per therapist – the front-desk view. */
export default function DayGrid({ day, data, staffFilter, t, onSlot, onBooking, onBlock }: DayGridProps) {
  const dayKey = toLocalDateString(day);
  const dayBookings = data.bookings.filter((b) => b.booking_date === dayKey);
  const columns = visibleStaff(data.staff, dayBookings, staffFilter);
  const allStaffIds = data.staff.map((s) => s.id);
  const workRanges = columns.map((s) => workRange(data.workingHours, s.id, day));
  const { startHour, endHour } = visibleHourRange(
    workRanges.filter((r) => r !== null) as { startMin: number; endMin: number }[],
    dayBookings.map(bookingRange),
  );
  const isToday = isSameDay(day, new Date());

  if (columns.length === 0) {
    return <p className="p-8 text-center text-sm text-stone-500">{t.noStaff}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="sticky top-0 z-40 flex border-b border-stone-200 bg-[#F7F5F2]/95 backdrop-blur">
          <div className="w-14 shrink-0" />
          {columns.map((staff, i) => {
            const color = staffColor(allStaffIds, staff.id);
            return (
              <div key={staff.id} className="flex min-w-[150px] flex-1 items-center gap-2 border-l border-stone-200/80 px-3 py-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color.border }} />
                <span className="truncate text-sm font-semibold text-[#1A1714]">{staff.name}</span>
                {!workRanges[i] && <span className="ml-auto shrink-0 text-[11px] text-stone-400">{t.notWorking}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex">
          <HourGutter startHour={startHour} endHour={endHour} />
          {columns.map((staff, i) => (
            <div key={staff.id} className="min-w-[150px] flex-1">
              <TimeColumn
                startHour={startHour}
                endHour={endHour}
                offRanges={offRanges(workRanges[i], startHour, endHour)}
                blocks={columnBlocks(data.blocks, day, [staff.id])}
                bookings={columnBookings(data.bookings, day, [staff.id], allStaffIds, data.staffNotes)}
                isToday={isToday}
                t={t}
                label={staff.name}
                onEmptyClick={(minutes) => onSlot(day, minutes, staff.id)}
                onBookingClick={onBooking}
                onBlockClick={onBlock}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
