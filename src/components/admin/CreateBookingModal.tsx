import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ADMIN_ATTRIBUTION } from '../../lib/attribution';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { toLocalDateString } from '../../lib/localDateTime';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText } from '../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT } from './adminUi';
import CalendarModal from './calendar/CalendarModal';
import CustomerPicker, { PickedCustomer } from './createBooking/CustomerPicker';
import { CREATE_BOOKING_TEXT } from './createBooking/createBookingText';

const SLOT_STEP_MINUTES = 15;

interface Service { id: string; name: string }
interface Duration { id: string; duration_minutes: number; price_cents: number }
interface Specialist { id: string; name: string }

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedDate?: string;
  /** "14:30" – chosen automatically when it is free. */
  preselectedTime?: string;
  preselectedSpecialistId?: string;
  /** Internal team note to start with (e.g. the comment of a reservation). */
  preselectedNote?: string;
  /** Starts the customer search with this text (e.g. a phone number). */
  customerQuery?: string;
  /**
   * Time held by the shop's own reservation (a blocked time being turned into
   * this appointment). The block hides it from the free-time engine, so it is
   * offered here explicitly; the block is removed only after saving.
   */
  reserved?: { date: string; time: string; specialistId: string };
}

/** Free start times of one therapist on one day, from the same engine the booking page uses. */
function useFreeTimes(businessId: string | null, durationId: string, specialistId: string, date: string) {
  const [times, setTimes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!businessId || !durationId || !specialistId || !date) { setTimes([]); return; }
    let isCancelled = false;
    setIsLoading(true);
    supabase
      .rpc('get_available_slots', {
        p_business_id: businessId, p_duration_id: durationId, p_specialist_id: specialistId,
        p_from: date, p_days: 1, p_step_minutes: SLOT_STEP_MINUTES, p_people: 1,
      })
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error) console.error('Could not load free times:', error);
        const rows = (data ?? []) as { slot_date: string; slot_time: string }[];
        setTimes(rows.filter((row) => row.slot_date === date).map((row) => row.slot_time.slice(0, 5)));
        setIsLoading(false);
      });
    return () => { isCancelled = true; };
  }, [businessId, durationId, specialistId, date]);
  return { times, isLoading };
}

/** One-page form: treatment → therapist → free time → customer. Opened from the calendar with day, time and therapist filled in. */
export default function CreateBookingModal(props: CreateBookingModalProps) {
  // Mount only while open, so every opening starts with a fresh form.
  return props.isOpen ? <CreateBookingForm {...props} /> : null;
}

function CreateBookingForm(props: CreateBookingModalProps) {
  const { onClose, onSuccess, preselectedDate, preselectedTime, preselectedSpecialistId, preselectedNote, customerQuery, reserved } = props;
  const { t, locale } = useAdminText(CREATE_BOOKING_TEXT);
  const { businessId } = useTenant();
  const { formatPrice } = useCurrency();
  const [services, setServices] = useState<Service[]>([]);
  const [durations, setDurations] = useState<Duration[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [durationId, setDurationId] = useState('');
  const [specialistId, setSpecialistId] = useState(preselectedSpecialistId ?? '');
  const [date, setDate] = useState(preselectedDate ?? toLocalDateString(new Date()));
  const [time, setTime] = useState('');
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [teamNote, setTeamNote] = useState(preselectedNote ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const { times: freeTimes, isLoading: isLoadingTimes } = useFreeTimes(businessId, durationId, specialistId, date);
  const isReservedHere = Boolean(reserved && reserved.date === date && reserved.specialistId === specialistId);
  const times = isReservedHere && reserved && !freeTimes.includes(reserved.time)
    ? [...freeTimes, reserved.time].sort()
    : freeTimes;

  useEffect(() => {
    if (!businessId) return;
    supabase.from('services').select('id, name').eq('business_id', businessId).order('name')
      .then(({ data }) => setServices((data ?? []) as Service[]));
    supabase.from('specialists').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name')
      .then(({ data }) => setSpecialists((data ?? []) as Specialist[]));
  }, [businessId]);

  useEffect(() => {
    if (!serviceId) { setDurations([]); return; }
    supabase.from('service_durations').select('id, duration_minutes, price_cents').eq('service_id', serviceId).order('duration_minutes')
      .then(({ data }) => {
        const rows = (data ?? []) as Duration[];
        setDurations(rows);
        setDurationId(rows.length === 1 ? rows[0].id : '');
      });
  }, [serviceId]);


  // The clicked time counts as chosen while it is free and nobody picked another one.
  const isPreselectedFree = Boolean(preselectedTime && date === preselectedDate && times.includes(preselectedTime));
  const chosenTime = time && times.includes(time) ? time : (!time && isPreselectedFree ? preselectedTime ?? '' : '');
  const duration = durations.find((d) => d.id === durationId);
  const isReadyForTimes = Boolean(serviceId && durationId && specialistId);
  const isPreselectedTaken = Boolean(preselectedTime && date === preselectedDate && isReadyForTimes && !isLoadingTimes && !times.includes(preselectedTime));
  const chip = (isActive: boolean) =>
    `rounded-xl border px-3.5 py-2.5 text-sm font-medium transition ${isActive ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'}`;

  const handleSubmit = async () => {
    setError('');
    if (!businessId || !serviceId || !duration || !specialistId || !chosenTime || !customer) { setError(t.errorMissing); return; }
    const name = customer.name.trim();
    const email = customer.email.trim().toLowerCase();
    const phone = customer.phone.trim();
    if (isNewCustomer && (!name || !email || !phone)) { setError(t.errorCustomerFields); return; }
    setIsSaving(true);
    try {
      if (isNewCustomer) {
        const { data: existing } = await supabase.from('customers').select('id').eq('business_id', businessId).eq('email', email).maybeSingle();
        if (!existing) {
          const { error: customerError } = await supabase.from('customers').insert({ business_id: businessId, email, name, phone });
          if (customerError) throw customerError;
        }
      }
      const { data: created, error: bookingError } = await supabase.from('bookings').insert({
        ...ADMIN_ATTRIBUTION,
        business_id: businessId,
        service_id: serviceId,
        duration_id: duration.id,
        specialist_id: specialistId,
        customer_email: email,
        customer_name: name,
        customer_phone: phone,
        booking_date: date,
        start_time: chosenTime,
        total_duration_minutes: duration.duration_minutes,
        total_price_cents: duration.price_cents,
        status: 'confirmed',
        payment_status: 'pending',
      }).select('id').single();
      if (bookingError) throw bookingError;
      const note = teamNote.trim();
      if (note && created) {
        const { error: noteError } = await supabase.from('booking_staff_notes').insert({ booking_id: created.id, business_id: businessId, note });
        if (noteError) console.error('Booking saved, team note not:', noteError);
      }
      onSuccess();
      onClose();
    } catch (saveError) {
      console.error('Could not create booking:', saveError);
      setError(t.errorCreate);
    } finally {
      setIsSaving(false);
    }
  };

  const serviceName = services.find((s) => s.id === serviceId)?.name;
  const subtitle = serviceName && chosenTime
    ? fillText(t.summary, { service: serviceName, date: new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }), time: chosenTime })
    : undefined;

  return (
    <CalendarModal title={t.title} subtitle={subtitle} closeLabel={t.close} onClose={() => { if (!isSaving) onClose(); }} maxWidthClass="max-w-2xl">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.service}</h3>
          <select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setTime(''); }} className={`${ADMIN_SELECT} py-3 text-[15px]`}>
            <option value="">{t.selectService}</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {durations.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label={t.duration}>
              {durations.map((d) => (
                <button key={d.id} type="button" onClick={() => setDurationId(d.id)} className={chip(durationId === d.id)}>
                  {fillText(t.durationOption, { minutes: d.duration_minutes, price: formatPrice(d.price_cents) })}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.therapist}</h3>
          <div className="flex flex-wrap gap-2">
            {specialists.map((s) => (
              <button key={s.id} type="button" onClick={() => setSpecialistId(s.id)} className={chip(specialistId === s.id)}>{s.name}</button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.dateTime}</h3>
          <input type="date" value={date} min={toLocalDateString(new Date())} onChange={(e) => { setDate(e.target.value); setTime(''); }} className={`${ADMIN_INPUT} max-w-xs`} />
          {!isReadyForTimes && <p className="text-sm text-stone-500">{t.chooseFirst}</p>}
          {isReadyForTimes && isLoadingTimes && <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" />{t.loadingTimes}</p>}
          {isPreselectedTaken && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{fillText(t.timeTaken, { time: preselectedTime ?? '' })}</p>}
          {isReadyForTimes && !isLoadingTimes && times.length === 0 && <p className="text-sm text-stone-500">{t.noSlots}</p>}
          {isReadyForTimes && !isLoadingTimes && times.length > 0 && (
            <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6" aria-label={t.freeTimes}>
              {times.map((slot) => (
                <button key={slot} type="button" onClick={() => setTime(slot)} className={`${chip(chosenTime === slot)} tabular-nums`}>{slot}</button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.customer}</h3>
          {businessId && (
            <CustomerPicker businessId={businessId} initialQuery={customerQuery} value={customer} isNew={isNewCustomer} t={t} onPick={setCustomer} onNew={setIsNewCustomer} />
          )}
        </section>

        <label className="block text-sm font-semibold text-[#1A1714]">{t.notes}
          <textarea value={teamNote} onChange={(e) => setTeamNote(e.target.value)} rows={3} maxLength={2000} placeholder={t.notesPlaceholder} className={`${ADMIN_INPUT} mt-2 font-normal`} />
          <span className="mt-1 block text-xs font-normal text-stone-400">{t.notesHint}</span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isSaving} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
          <button type="button" onClick={handleSubmit} disabled={isSaving} className={`${ADMIN_PRIMARY_BUTTON} px-6 py-3 text-[15px]`}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isSaving ? t.creating : t.createBooking}
          </button>
        </div>
      </div>
    </CalendarModal>
  );
}
