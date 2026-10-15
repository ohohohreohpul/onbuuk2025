import { useCallback, useEffect, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';
import { toLocalDateString } from '../../lib/localDateTime';
import { ADMIN_SURFACE } from './adminUi';
import QuickPay, { STEP_SELECT } from './bookings/QuickPay';
import RecordPaymentModal from './bookings/RecordPaymentModal';
import { markBookingNoShow, setBookingStatus } from './bookings/bookingActions';
import type { BookingPayment } from './bookings/paymentMethods';
import { openCentsOf, stepOf } from './bookings/bookingSteps';
import { markOrderPaid, type ShopPaymentMethod } from './giftCardOrders/giftCardOrdersApi';

const TEXT: Translations<{
  title: string; today: string; more: string; loadFailed: string; actionFailed: string;
  confirmed: string; showedUp: string; paid: string; choose: string; yes: string; no: string; cash: string; card: string;
  declineConfirm: string; noShowConfirm: string; voucherOrder: string;
}> = {
  en: {
    title: 'To do', today: 'Today', more: '{count} more in Bookings', loadFailed: 'Could not load open items.', actionFailed: 'Could not save. Please try again.',
    confirmed: 'Confirmed', showedUp: 'Showed up', paid: 'Paid', choose: 'Choose…', yes: 'Yes', no: 'No', cash: 'Cash', card: 'Card',
    declineConfirm: 'Decline the booking of {name}? The customer is informed by email.', noShowConfirm: 'Mark {name} as no-show?',
    voucherOrder: 'Gift card order {code}',
  },
  de: {
    title: 'Zu erledigen', today: 'Heute', more: '{count} weitere unter Buchungen', loadFailed: 'Offene Punkte konnten nicht geladen werden.', actionFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    confirmed: 'Bestätigt', showedUp: 'Erschienen', paid: 'Bezahlt', choose: 'Auswählen…', yes: 'Ja', no: 'Nein', cash: 'Bar', card: 'Karte',
    declineConfirm: 'Buchung von {name} ablehnen? Die Kundin bzw. der Kunde wird per E-Mail informiert.', noShowConfirm: '{name} als nicht erschienen eintragen?',
    voucherOrder: 'Gutschein-Bestellung {code}',
  },
  th: {
    title: 'สิ่งที่ต้องทำ', today: 'วันนี้', more: 'อีก {count} รายการในหน้าการจอง', loadFailed: 'โหลดรายการไม่สำเร็จ', actionFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    confirmed: 'ยืนยัน', showedUp: 'ลูกค้ามา', paid: 'ชำระ', choose: 'เลือก…', yes: 'ใช่', no: 'ไม่', cash: 'เงินสด', card: 'บัตร',
    declineConfirm: 'ปฏิเสธการจองของ {name}? ลูกค้าจะได้รับอีเมลแจ้ง', noShowConfirm: 'บันทึกว่า {name} ไม่มาตามนัด?',
    voucherOrder: 'คำสั่งซื้อบัตรของขวัญ {code}',
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

interface OpenOrder {
  id: string;
  order_number: string;
  title: string;
  total_cents: number;
  buyer_name: string;
  created_at: string;
}

const addDays = (days: number) => toLocalDateString(new Date(Date.now() + days * 86400000));

function Step({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <label className={`flex items-center gap-2 ${muted ? 'opacity-50' : ''}`}>
      <span className="text-xs font-medium text-stone-500">{label}</span>
      {children}
    </label>
  );
}

interface OpenBookingsCardProps {
  businessId: string;
  onShowAll: () => void;
}

/**
 * Dashboard "Zu erledigen": bookings that still need confirming, checking in or
 * paying, and gift card orders waiting to be paid in the shop. One row each,
 * one dropdown per step; the row disappears once everything is done.
 */
export default function OpenBookingsCard({ businessId, onShowAll }: OpenBookingsCardProps) {
  const { t, locale } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<OpenBooking[]>([]);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paying, setPaying] = useState<OpenBooking | null>(null);
  const today = toLocalDateString(new Date());

  const load = useCallback(async () => {
    if (!businessId) return;
    const [bookingRes, orderRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, start_time, status, payment_status, customer_name, customer_email, final_amount_cents, service:services(name, no_show_fee), duration:service_durations(price_cents), payments:booking_payments(method, amount_cents, voided_at, gift_card_id)')
        .eq('business_id', businessId)
        .in('status', ['pending', 'confirmed', 'completed'])
        .or('no_show.is.null,no_show.eq.false')
        .gte('booking_date', addDays(-LOOKBACK_DAYS))
        .lte('booking_date', addDays(LOOKAHEAD_DAYS))
        .order('booking_date')
        .order('start_time'),
      supabase
        .from('gift_card_orders')
        .select('id, order_number, title, total_cents, buyer_name, created_at')
        .eq('business_id', businessId)
        .eq('status', 'pending_payment')
        .order('created_at'),
    ]);
    if (bookingRes.error || orderRes.error) {
      console.error('Could not load open items:', bookingRes.error || orderRes.error);
      setError(t.loadFailed);
      return;
    }
    setError('');
    setBookings((bookingRes.data ?? []) as unknown as OpenBooking[]);
    setOrders((orderRes.data ?? []) as OpenOrder[]);
  }, [businessId, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      await load();
    } catch (actionError) {
      console.error('Action failed:', actionError);
      setError(t.actionFailed);
    } finally {
      setBusyId(null);
    }
  };

  const onConfirm = (b: OpenBooking, value: string) => {
    if (value === 'yes') run(b.id, () => setBookingStatus(b.id, 'confirmed'));
    if (value === 'no' && confirm(fillText(t.declineConfirm, { name: b.customer_name }))) run(b.id, () => setBookingStatus(b.id, 'cancelled'));
  };
  const onShowedUp = (b: OpenBooking, value: string) => {
    if (value === 'yes') run(b.id, () => setBookingStatus(b.id, 'completed'));
    if (value === 'no' && confirm(fillText(t.noShowConfirm, { name: b.customer_name }))) {
      run(b.id, () => markBookingNoShow(businessId, b, `No-show for ${b.service?.name ?? ''} on ${b.booking_date} at ${b.start_time}`));
    }
  };
  const onOrderPaid = (order: OpenOrder, value: string) => {
    if (value === 'cash' || value === 'card') run(order.id, () => markOrderPaid(order.id, value as ShopPaymentMethod));
  };

  const open = bookings
    .map((booking) => ({ booking, step: stepOf(booking, today) }))
    .filter((row): row is { booking: OpenBooking; step: 1 | 2 | 3 } => row.step !== 'done' && row.step !== 'wait');
  const total = open.length + orders.length;
  if (!error && total === 0) return null;

  const day = (date: string) => (date === today ? t.today : new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }));
  const yesNo = (done: boolean, enabled: boolean, busy: boolean, onChange: (value: string) => void) => (
    <select value={done ? 'yes' : ''} disabled={done || !enabled || busy} onChange={(e) => onChange(e.target.value)} className={STEP_SELECT}>
      {!done && <option value="">{t.choose}</option>}
      <option value="yes">{t.yes}</option>
      {!done && <option value="no">{t.no}</option>}
    </select>
  );

  return (
    <section className={`${ADMIN_SURFACE} p-5`} aria-labelledby="todo-title">
      <h2 id="todo-title" className="mb-2 text-[15px] font-semibold text-[#1A1714]">
        {t.title} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{total}</span>
      </h2>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-stone-200/70">
        {open.slice(0, SHOWN).map(({ booking: b, step }) => {
          const busy = busyId === b.id;
          return (
            <li key={b.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1A1714]">{b.customer_name}</p>
                <p className="truncate text-xs text-stone-500">{day(b.booking_date)} · {b.start_time.slice(0, 5)} · {b.service?.name} · {formatPrice(b.final_amount_cents ?? b.duration?.price_cents ?? 0)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Step label={t.confirmed}>{yesNo(step > 1, step === 1, busy, (v) => onConfirm(b, v))}</Step>
                <Step label={t.showedUp} muted={step < 2}>{yesNo(step > 2, step === 2, busy, (v) => onShowedUp(b, v))}</Step>
                <Step label={t.paid} muted={step < 3}>
                  <QuickPay asSelect label={t.paid} disabled={step !== 3 || busy} bookingId={b.id} openCents={openCentsOf(b)} onOther={() => setPaying(b)} onPaid={load} />
                </Step>
              </div>
            </li>
          );
        })}
        {orders.map((order) => (
          <li key={order.id} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <Gift className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1A1714]">{order.buyer_name}</p>
                <p className="truncate text-xs text-stone-500">{fillText(t.voucherOrder, { code: order.order_number })} · {order.title} · {formatPrice(order.total_cents)}</p>
              </div>
            </div>
            <Step label={t.paid}>
              <select value="" disabled={busyId === order.id} onChange={(e) => onOrderPaid(order, e.target.value)} className={STEP_SELECT}>
                <option value="">{t.choose}</option>
                <option value="cash">{t.cash}</option>
                <option value="card">{t.card}</option>
              </select>
              {busyId === order.id && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
            </Step>
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
