import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { toLocalDateString } from '../../../lib/localDateTime';
import { ADMIN_INPUT, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../adminUi';

export interface MovableBooking {
  id: string;
  booking_date: string;
  start_time: string;
  duration_id: string;
  specialist_id: string | null;
  is_pair_booking: boolean | null;
  customer_name: string;
}

interface RescheduleModalProps {
  booking: MovableBooking;
  onClose: () => void;
  onMoved: () => void;
}

const TIME_PATTERN = /^\d{2}:\d{2}$/;

/** Move a booking to another day/time for the same therapist. The customer is emailed. */
export default function RescheduleModal({ booking, onClose, onMoved }: RescheduleModalProps) {
  const { businessId } = useTenant();
  const [date, setDate] = useState(booking.booking_date);
  const [time, setTime] = useState(booking.start_time.slice(0, 5));
  const [freeTimes, setFreeTimes] = useState<string[]>([]);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId || !date) return;
    let isCancelled = false;
    setIsLoadingTimes(true);
    supabase
      .rpc('get_available_slots', {
        p_business_id: businessId,
        p_duration_id: booking.duration_id,
        p_specialist_id: booking.specialist_id,
        p_from: date,
        p_days: 1,
        p_people: booking.is_pair_booking ? 2 : 1,
      })
      .then(({ data, error: slotsError }) => {
        if (isCancelled) return;
        if (slotsError) console.error('Could not load free times:', slotsError);
        const rows = (data ?? []) as { slot_date: string; slot_time: string }[];
        setFreeTimes(rows.filter((row) => row.slot_date === date).map((row) => row.slot_time.slice(0, 5)));
        setIsLoadingTimes(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [businessId, date, booking.duration_id, booking.specialist_id, booking.is_pair_booking]);

  const save = async () => {
    if (!date || !TIME_PATTERN.test(time)) {
      setError('Choose a date and a time.');
      return;
    }
    setIsSaving(true);
    setError(null);
    const { error: moveError } = await supabase
      .from('bookings')
      .update({ booking_date: date, start_time: time })
      .eq('id', booking.id);
    setIsSaving(false);
    if (moveError) {
      setError(moveError.message.includes('SLOT_UNAVAILABLE')
        ? 'That time is taken or the shop is closed then. Pick another time.'
        : 'Could not move the booking. Please try again.');
      return;
    }
    onMoved();
  };

  const isUnchanged = date === booking.booking_date && time === booking.start_time.slice(0, 5);

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-stone-600" aria-hidden="true" />
            <h2 id="reschedule-title" className="text-lg font-semibold text-[#1A1714]">Move appointment</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-stone-400 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-stone-500">
          {booking.customer_name} gets an email with the new time and a new reminder.
        </p>

        <label htmlFor="reschedule-date" className="block text-sm font-medium text-stone-700">Date</label>
        <input
          id="reschedule-date"
          type="date"
          min={toLocalDateString(new Date())}
          className={`${ADMIN_INPUT} mt-1.5`}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <p className="mt-4 text-sm font-medium text-stone-700">Free times</p>
        <div className="mt-2 flex min-h-[2.5rem] flex-wrap gap-2">
          {isLoadingTimes && <Loader2 className="h-4 w-4 animate-spin text-stone-400" aria-label="Loading free times" />}
          {!isLoadingTimes && freeTimes.length === 0 && (
            <span className="text-sm text-stone-400">No free times that day — you can still enter a time below.</span>
          )}
          {!isLoadingTimes && freeTimes.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setTime(slot)}
              aria-pressed={time === slot}
              className={`rounded-lg border px-3 py-1.5 text-sm tabular-nums transition ${time === slot ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
            >
              {slot}
            </button>
          ))}
        </div>

        <label htmlFor="reschedule-time" className="mt-4 block text-sm font-medium text-stone-700">Time</label>
        <input id="reschedule-time" type="time" step={300} className={`${ADMIN_INPUT} mt-1.5`} value={time} onChange={(e) => setTime(e.target.value)} />

        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>Cancel</button>
          <button type="button" onClick={save} disabled={isSaving || isUnchanged} className={ADMIN_PRIMARY_BUTTON}>
            {isSaving ? 'Moving…' : 'Move appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}
