import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { toLocalDateString } from '../../../lib/localDateTime';
import { addDays } from './calendarModel';

/** Online bookings keep arriving while the front desk has the calendar open. */
const REFRESH_INTERVAL_MS = 60_000;

export interface CalendarStaff {
  id: string;
  name: string;
  is_active: boolean;
}

export interface CalendarWorkingHour {
  specialist_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface CalendarBlock {
  id: string;
  specialist_id: string | null;
  start_time: string;
  end_time: string;
  reason: string | null;
  color: string | null;
}

export interface CalendarBooking {
  id: string;
  customer_name: string;
  specialist_id: string | null;
  partner_specialist_id: string | null;
  booking_date: string;
  start_time: string;
  duration_id: string;
  total_duration_minutes: number | null;
  status: string;
  no_show: boolean | null;
  is_pair_booking: boolean | null;
  payment_status: string | null;
  services?: { name: string } | null;
  service_durations?: { duration_minutes: number } | null;
}

export interface CalendarData {
  staff: CalendarStaff[];
  workingHours: CalendarWorkingHour[];
  blocks: CalendarBlock[];
  bookings: CalendarBooking[];
  /** booking id -> internal team note */
  staffNotes: Map<string, string>;
}

const EMPTY: CalendarData = { staff: [], workingHours: [], blocks: [], bookings: [], staffNotes: new Map() };

const BOOKING_COLUMNS =
  'id, customer_name, specialist_id, partner_specialist_id, booking_date, start_time, duration_id, '
  + 'total_duration_minutes, status, no_show, is_pair_booking, payment_status, services(name), service_durations(duration_minutes)';

async function loadCalendar(businessId: string, from: Date, to: Date): Promise<CalendarData> {
  const fromDay = toLocalDateString(from);
  const toDay = toLocalDateString(to);
  const [staff, hours, blocks, bookings] = await Promise.all([
    supabase.from('specialists').select('id, name, is_active').eq('business_id', businessId).order('name'),
    supabase.from('working_hours').select('specialist_id, day_of_week, start_time, end_time, is_available').eq('business_id', businessId),
    supabase
      .from('time_blocks')
      .select('id, specialist_id, start_time, end_time, reason, color')
      .eq('business_id', businessId)
      .lt('start_time', addDays(to, 1).toISOString())
      .gt('end_time', from.toISOString()),
    supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('business_id', businessId)
      .gte('booking_date', fromDay)
      .lte('booking_date', toDay)
      .neq('status', 'cancelled')
      .order('start_time'),
  ]);
  const firstError = staff.error ?? hours.error ?? blocks.error ?? bookings.error;
  if (firstError) throw firstError;
  // Filtered through the booking date, so a busy month doesn't need a URL with hundreds of ids.
  const notes = await supabase
    .from('booking_staff_notes')
    .select('booking_id, note, bookings!inner(booking_date)')
    .eq('business_id', businessId)
    .gte('bookings.booking_date', fromDay)
    .lte('bookings.booking_date', toDay);
  if (notes.error) console.error('Could not load team notes:', notes.error);
  return {
    staffNotes: new Map((notes.data ?? []).map((n: { booking_id: string; note: string }) => [n.booking_id, n.note])),
    staff: (staff.data ?? []) as CalendarStaff[],
    workingHours: (hours.data ?? []) as CalendarWorkingHour[],
    blocks: (blocks.data ?? []) as CalendarBlock[],
    bookings: (bookings.data ?? []) as unknown as CalendarBooking[],
  };
}

/** Therapists, working hours, blocked times and appointments for a date range. */
export function useCalendarData(businessId: string | null, from: Date, to: Date) {
  const [data, setData] = useState<CalendarData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const requestRef = useRef(0);
  const fromKey = toLocalDateString(from);
  const toKey = toLocalDateString(to);

  const reload = useCallback(async () => {
    if (!businessId) return;
    const requestId = ++requestRef.current;
    try {
      const next = await loadCalendar(businessId, from, to);
      if (requestId !== requestRef.current) return;
      setData(next);
      setHasError(false);
    } catch (error) {
      console.error('Could not load the calendar:', error);
      if (requestId === requestRef.current) setHasError(true);
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
    // from/to are represented by their day keys
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, fromKey, toKey]);

  useEffect(() => {
    setIsLoading(true);
    reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  return { data, isLoading, hasError, reload };
}
