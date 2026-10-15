import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';
import { toLocalDateString } from '../../lib/localDateTime';
import { ADMIN_SURFACE } from './adminUi';
import QuickPay from './bookings/QuickPay';
import RecordPaymentModal from './bookings/RecordPaymentModal';
import { openAmountCents, type BookingPayment } from './bookings/paymentMethods';

const TEXT: Translations<{ title: string; hint: string; more: string; loadFailed: string; today: string }> = {
  en: { title: 'Open payments', hint: 'Appointments up to today that are not paid yet.', more: '{count} more in Bookings', loadFailed: 'Could not load open payments.', today: 'Today' },
  de: { title: 'Offene Zahlungen', hint: 'Termine bis heute, die noch nicht bezahlt sind.', more: '{count} weitere unter Buchungen', loadFailed: 'Offene Zahlungen konnten nicht geladen werden.', today: 'Heute' },
  th: { title: 'ยอดค้างชำระ', hint: 'นัดหมายจนถึงวันนี้ที่ยังไม่ได้ชำระ', more: 'อีก {count} รายการในหน้าการจอง', loadFailed: 'โหลดยอดค้างชำระไม่สำเร็จ', today: 'วันนี้' },
};

const SHOWN = 6;

interface OpenBooking {
  id: string;
  booking_date: string;
  start_time: string;
  customer_name: string;
  final_amount_cents: number | null;
  service: { name: string } | null;
  duration: { price_cents: number } | null;
  payments: BookingPayment[] | null;
}

interface OpenPaymentsCardProps {
  businessId: string;
  onShowAll: () => void;
}

/** Dashboard: unpaid appointments up to today, each payable with one tap. Hidden when nothing is open. */
export default function OpenPaymentsCard({ businessId, onShowAll }: OpenPaymentsCardProps) {
  const { t, locale } = useAdminText(TEXT);
  const [bookings, setBookings] = useState<OpenBooking[]>([]);
  const [error, setError] = useState(false);
  const [paying, setPaying] = useState<OpenBooking | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    const { data, error: loadError } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, customer_name, final_amount_cents, service:services(name), duration:service_durations(price_cents), payments:booking_payments(method, amount_cents, voided_at, gift_card_id)')
      .eq('business_id', businessId)
      .eq('payment_status', 'pending')
      .neq('status', 'cancelled')
      .or('no_show.is.null,no_show.eq.false')
      .lte('booking_date', toLocalDateString(new Date()))
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });
    if (loadError) {
      console.error('Could not load open payments:', loadError);
      setError(true);
      return;
    }
    setError(false);
    setBookings((data ?? []) as unknown as OpenBooking[]);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const openOf = (booking: OpenBooking) =>
    openAmountCents(booking.final_amount_cents ?? booking.duration?.price_cents ?? 0, booking.payments ?? []);
  const open = bookings.filter((booking) => openOf(booking) > 0);
  if (!error && open.length === 0) return null;

  const today = toLocalDateString(new Date());
  const day = (date: string) => (date === today ? t.today : new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }));

  return (
    <section className={`${ADMIN_SURFACE} p-5`} aria-labelledby="open-payments-title">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="open-payments-title" className="text-[15px] font-semibold text-[#1A1714]">{t.title} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{open.length}</span></h2>
        <p className="hidden text-xs text-stone-500 sm:block">{t.hint}</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{t.loadFailed}</p>}
      <ul className="divide-y divide-stone-200/70">
        {open.slice(0, SHOWN).map((booking) => (
          <li key={booking.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#1A1714]">{booking.customer_name}</p>
              <p className="text-xs text-stone-500">{day(booking.booking_date)} · {booking.start_time.slice(0, 5)} · {booking.service?.name}</p>
            </div>
            <QuickPay bookingId={booking.id} openCents={openOf(booking)} onOther={() => setPaying(booking)} onPaid={load} />
          </li>
        ))}
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
