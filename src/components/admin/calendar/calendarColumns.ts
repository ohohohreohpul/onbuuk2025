import { toLocalDateString } from '../../../lib/localDateTime';
import {
  MINUTES_PER_HOUR, MinuteRange, Placed, blockRangeOnDay, layoutLanes, staffColor, toMinutes,
} from './calendarModel';
import type { ColumnBlock, ColumnBooking } from './TimeColumn';
import type { CalendarBlock, CalendarBooking, CalendarStaff, CalendarWorkingHour } from './useCalendarData';

/** Working time of one therapist on a day (day_of_week: 0 = Sunday), or null when off. */
export function workRange(hours: CalendarWorkingHour[], specialistId: string, day: Date): MinuteRange | null {
  const entry = hours.find((h) => h.specialist_id === specialistId && h.day_of_week === day.getDay());
  if (!entry || !entry.is_available) return null;
  const range = { startMin: toMinutes(entry.start_time), endMin: toMinutes(entry.end_time) };
  return range.endMin > range.startMin ? range : null;
}

/** The grey parts of a column: everything outside the open ranges. */
export function offRanges(open: MinuteRange | null, startHour: number, endHour: number): MinuteRange[] {
  const viewStart = startHour * MINUTES_PER_HOUR;
  const viewEnd = endHour * MINUTES_PER_HOUR;
  if (!open) return [{ startMin: viewStart, endMin: viewEnd }];
  return [
    { startMin: viewStart, endMin: Math.max(viewStart, open.startMin) },
    { startMin: Math.min(viewEnd, open.endMin), endMin: viewEnd },
  ].filter((r) => r.endMin > r.startMin);
}

/** Earliest start to latest end of everyone working that day. */
export function shopOpenRange(hours: CalendarWorkingHour[], staffIds: string[], day: Date): MinuteRange | null {
  const ranges = staffIds.map((id) => workRange(hours, id, day)).filter((r): r is MinuteRange => r !== null);
  if (ranges.length === 0) return null;
  return { startMin: Math.min(...ranges.map((r) => r.startMin)), endMin: Math.max(...ranges.map((r) => r.endMin)) };
}

/** Blocks shown in a column: shop closures plus (optionally) the therapists' own blocks. */
export function columnBlocks(blocks: CalendarBlock[], day: Date, specialistIds: string[] | null): ColumnBlock[] {
  return blocks.flatMap((block) => {
    const isShopClosure = block.specialist_id === null;
    const isRelevant = isShopClosure || (specialistIds !== null && specialistIds.includes(block.specialist_id as string));
    const range = isRelevant ? blockRangeOnDay(block, day) : null;
    return range ? [{ ...range, block, isShopClosure }] : [];
  });
}

/** Appointments of a day for the given therapists (null = everyone), laid out in lanes. */
export function columnBookings(
  bookings: CalendarBooking[],
  day: Date,
  specialistIds: string[] | null,
  allStaffIds: string[],
  staffNotes: Map<string, string> = new Map(),
): Placed<ColumnBooking>[] {
  const dayKey = toLocalDateString(day);
  const items = bookings
    .filter((b) => b.booking_date === dayKey)
    .filter((b) => specialistIds === null
      || specialistIds.includes(b.specialist_id ?? '')
      || specialistIds.includes(b.partner_specialist_id ?? ''))
    .map((booking) => ({
      ...bookingRange(booking),
      booking,
      color: staffColor(allStaffIds, booking.specialist_id),
      note: staffNotes.get(booking.id),
    }));
  return layoutLanes(items);
}

/** Therapists shown as columns: active ones, plus inactive ones who still have appointments in view. */
export function visibleStaff(staff: CalendarStaff[], bookings: CalendarBooking[], filter: string | null): CalendarStaff[] {
  const booked = new Set(bookings.flatMap((b) => [b.specialist_id, b.partner_specialist_id]));
  return staff
    .filter((s) => s.is_active || booked.has(s.id))
    .filter((s) => filter === null || s.id === filter);
}

/** Start/end minutes of an appointment. */
export function bookingRange(booking: CalendarBooking): MinuteRange {
  const startMin = toMinutes(booking.start_time);
  const duration = booking.total_duration_minutes ?? booking.service_durations?.duration_minutes ?? MINUTES_PER_HOUR;
  return { startMin, endMin: startMin + duration };
}
