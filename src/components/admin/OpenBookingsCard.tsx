import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';
import { toLocalDateString } from '../../lib/localDateTime';
import { ADMIN_SURFACE } from './adminUi';
import QuickPay from './bookings/QuickPay';
import RecordPaymentModal from './bookings/RecordPaymentModal';
import { markBookingNoShow, setBookingStatus } from './bookings/bookingActions';
import type { BookingPayment } from './bookings/paymentMethods';
import { openCentsOf, stepOf } from './bookings/bookingSteps';

const TEXT: Translations<{
  title: string; hint: string; today: string; more: string; loadFailed: string; actionFailed: string;
  confirmed: string; showedUp: string; paid: string; yes: string; no: string;
  declineConfirm: string; noShowConfirm: string; done: string;
}> = {
  en: {
    title: 'Open bookings', hint: 'Confirm, check in and take payment – one row per booking.', today: 'Today',
    more: '{count} more in Bookings', loadFailed: 'Could not load open bookings.', actionFailed: 'Could not save. Please try again.',
    confirmed: 'Confirmed?', showedUp: 'Showed up?', paid: 'Paid with', yes: 'Yes', no: 'No',
    declineConfirm: 'Decline the booking of {name}? The customer is informed by email.',
    noShowConfirm: 'Mark {name} as no-show?', done: 'Done',
  },
  de: {
    title: 'Offene Buchungen', hint: 'Bestätigen, Erscheinen eintragen, kassieren – eine Zeile pro Buchung.', today: 'Heute',
    more: '{count} weitere unter Buchungen', loadFailed: 'Offene Buchungen konnten nicht geladen werden.', actionFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    confirmed: 'Bestätigt?', showedUp: 'Erschienen?', paid: 'Bezahlt mit', yes: 'Ja', no: 'Nein',
    declineConfirm: 'Buchung von {name} ablehnen? Die Kundin bzw. der Kunde wird per E-Mail informiert.',
    noShowConfirm: '{name} als nicht erschienen eintragen?', done: 'Erledigt',
  },
  th: {
    title: 'การจองที่ต้องดำเนินการ', hint: 'ยืนยัน บันทึกการมา และรับชำระ – หนึ่งแถวต่อหนึ่งการจอง', today: 'วันนี้',
    more: 'อีก {count} รายการในหน้าการจอง', loadFailed: 'โหลดการจองไม่สำเร็จ', actionFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    confirmed: 'ยืนยันแล้ว?', showedUp: 'ลูกค้ามา?', paid: 'ชำระด้วย', yes: 'ใช่', no: 'ไม่',
    declineConfirm: 'ปฏิเสธการจองของ {name}? ลูกค้าจะได้รับอีเมลแจ้ง', noShowConfirm: 'บันทึกว่า {name} ไม่มาตามนัด?', done: 'เรียบร้อย',
  },
};

const SHOWN = 8;
const LOOKBACK_DAYS = 60;
const LOOKAHEAD_DAYS = 60;

interface OpenBooking {
  id: string;
  booking_date: string;
  start_time: string;
  status: 'pending' | 'confirmed' | 'completed';
  payment_status: string | null;
  customer_name: string;
  customer_email: string;
  final_amount_cents: number | null;
  service: { name: string; no_show_fee: number } | null;
  duration: { price_cents: number } | null;
  payments: BookingPayment[] | null;
}

const addDays = (days: number) => toLocalDateString(new Date(Date.now() + days * 86400000));
const openOf = openCentsOf;

const STEP_ON = 'inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 disabled:opacity-40';
const YES = `${STEP_ON} bg-[#1A1714] text-white hover:bg-[#2E2926]`;
const NO = `${STEP_ON} bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50`;

interface OpenBookingsCardProps {
  businessId: string;
  onShowAll: () => void;
}

/** Dashboard: every booking that still needs a tap – confirm, check in, take payment – in one row. */
export default function OpenBookingsCard({ businessId, onShowAll }: OpenBookingsCardProps) {
  const { t, locale } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<OpenBooking[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paying, setPaying] = useState<OpenBooking | null>(null);
  const today = toLocalDateString(new Date());

  const load = useCallback(async () => {
    if (!businessId) return;
    const { data, error: loadError } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, status, payment_status, customer_name, customer_email, final_amount_cents, service:services(name, no_show_fee), duration:service_durations(price_cents), payments:booking_payments(method, amount_cents, voided_at, gift_card_id)')
      .eq('business_id', businessId)
      .in('status', ['pending', 'confirmed', 'completed'])
      .or('no_show.is.null,no_show.eq.false')
      .gte('booking_date', addDays(-LOOKBACK_DAYS))
      .lte('booking_date', addDays(LOOKAHEAD_DAYS))
      .order('booking_date')
      .order('start_time');
    if (loadError) {
      console.error('Could not load open bookings:', loadError);
      setError(t.loadFailed);
      return;
    }
    setError('');
    setBookings((data ?? []) as unknown as OpenBooking[]);
  }, [businessId, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  const run = async (booking: OpenBooking, action: () => Promise<unknown>) => {
    setBusyId(booking.id);
    setError('');
    try {
      await action();
      await load();
    } catch (actionError) {
      console.error('Booking action failed:', actionError);
      setError(t.actionFailed);
    } finally {
      setBusyId(null);
    }
  };

  const decline = (b: OpenBooking) => {
    if (confirm(fillText(t.declineConfirm, { name: b.customer_name }))) run(b, () => setBookingStatus(b.id, 'cancelled'));
  };
  const noShow = (b: OpenBooking) => {
    if (!confirm(fillText(t.noShowConfirm, { name: b.customer_name }))) return;
    run(b, () => markBookingNoShow(businessId, b, `No-show for ${b.service?.name ?? ''} on ${b.booking_date} at ${b.start_time}`));
  };

  const open = bookings
    .map((booking) => ({ booking, step: stepOf(booking, today) }))
    .filter((row): row is { booking: OpenBooking; step: 1 | 2 | 3 } => row.step !== 'done' && row.step !== 'wait');
  if (!error && open.length === 0) return null;

  const day = (date: string) => (date === today ? t.today : new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }));
  const doneMark = <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" aria-hidden="true" />{t.done}</span>;

  return (
    <section className={`${ADMIN_SURFACE} p-5`} aria-labelledby="open-bookings-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="open-bookings-title" className="text-[15px] font-semibold text-[#1A1714]">
          {t.title} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{open.length}</span>
        </h2>
        <p className="text-xs text-stone-500">{t.hint}</p>
      </div>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-stone-200/70">
        {open.slice(0, SHOWN).map(({ booking: b, step }) => {
          const busy = busyId === b.id;
          return (
            <li key={b.id} className="grid gap-3 py-3.5 lg:grid-cols-[minmax(0,1.3fr)_auto_auto_auto] lg:items-center lg:gap-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1A1714]">{b.customer_name}</p>
                <p className="truncate text-xs text-stone-500">
                  {day(b.booking_date)} · {b.start_time.slice(0, 5)} · {b.service?.name} · {formatPrice(b.final_amount_cents ?? b.duration?.price_cents ?? 0)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-24 text-xs font-medium text-stone-500 lg:w-auto">1. {t.confirmed}</span>
                {step > 1 ? doneMark : (
                  <>
                    <button type="button" className={YES} disabled={busy} onClick={() => run(b, () => setBookingStatus(b.id, 'confirmed'))}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.yes}</button>
                    <button type="button" className={NO} disabled={busy} onClick={() => decline(b)}>{t.no}</button>
                  </>
                )}
              </div>

              <div className={`flex items-center gap-2 ${step < 2 ? 'opacity-40' : ''}`}>
                <span className="w-24 text-xs font-medium text-stone-500 lg:w-auto">2. {t.showedUp}</span>
                {step > 2 ? doneMark : (
                  <>
                    <button type="button" className={YES} disabled={busy || step !== 2} onClick={() => run(b, () => setBookingStatus(b.id, 'completed'))}>{t.yes}</button>
                    <button type="button" className={NO} disabled={busy || step !== 2} onClick={() => noShow(b)}>{t.no}</button>
                  </>
                )}
              </div>

              <div className={`flex items-center gap-2 ${step < 3 ? 'opacity-40' : ''}`}>
                <span className="w-24 text-xs font-medium text-stone-500 lg:w-auto">3. {t.paid}</span>
                <QuickPay compact disabled={step !== 3 || busy} bookingId={b.id} openCents={openOf(b)} onOther={() => setPaying(b)} onPaid={load} />
              </div>
            </li>
          );
        })}
      </ul>
      {open.length > SHOWN && (
        <button type="button" onClick={onShowAll} className="mt-2 text-sm font-medium text-stone-600 underline-offset-2 hover:text-[#1A1714] hover:underline">
          {fillText(t.more, { count: open.length - SHOWN })}
        </button>
      )}
      {paying && <RecordPaymentModal booking={paying} onClose={() => setPaying(null)} onChanged={load} />}
    </section>
  );
}
