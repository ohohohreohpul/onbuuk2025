import { useCallback, useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';
import { toLocalDateString } from '../../lib/localDateTime';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from './adminUi';
import BookingTaskModal from './bookings/BookingTaskModal';
import type { BookingPayment } from './bookings/paymentMethods';
import { stepOf } from './bookings/bookingSteps';
import OrderTaskModal from './giftCardOrders/OrderTaskModal';

const TEXT: Translations<{
  title: string; today: string; more: string; loadFailed: string; edit: string;
  needsConfirm: string; needsAttendance: string; notPaid: string; orderNotPaid: string; orderNumber: string;
}> = {
  en: {
    title: 'To do', today: 'Today', more: '{count} more in Bookings', loadFailed: 'Could not load open items.', edit: 'Open',
    needsConfirm: 'Not confirmed yet', needsAttendance: 'Did the customer come?', notPaid: 'Not paid yet', orderNotPaid: 'Voucher not paid yet', orderNumber: 'Order',
  },
  de: {
    title: 'Zu erledigen', today: 'Heute', more: '{count} weitere unter Buchungen', loadFailed: 'Offene Punkte konnten nicht geladen werden.', edit: 'Bearbeiten',
    needsConfirm: 'Noch nicht bestätigt', needsAttendance: 'Gekommen? Noch eintragen', notPaid: 'Noch nicht bezahlt', orderNotPaid: 'Gutschein noch nicht bezahlt', orderNumber: 'Bestellung',
  },
  th: {
    title: 'สิ่งที่ต้องทำ', today: 'วันนี้', more: 'อีก {count} รายการในหน้าการจอง', loadFailed: 'โหลดรายการไม่สำเร็จ', edit: 'แก้ไข',
    needsConfirm: 'ยังไม่ยืนยัน', needsAttendance: 'ลูกค้ามาหรือไม่? ยังไม่บันทึก', notPaid: 'ยังไม่ชำระ', orderNotPaid: 'บัตรของขวัญยังไม่ชำระ', orderNumber: 'คำสั่งซื้อ',
  },
};

const SHOWN = 8;
const LOOKBACK_DAYS = 60;
const LOOKAHEAD_DAYS = 60;
const STATUS_PILL = 'inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900';

interface OpenBooking {
  id: string;
  booking_date: string;
  start_time: string;
  status: 'pending' | 'confirmed' | 'completed';
  payment_status: string | null;
  customer_name: string;
  final_amount_cents: number | null;
  service: { name: string } | null;
  duration: { price_cents: number } | null;
  payments: BookingPayment[] | null;
}

interface OpenOrder {
  id: string;
  order_number: string;
  title: string;
  total_cents: number;
  buyer_name: string;
}

type Opened = { kind: 'booking' | 'order'; id: string } | null;

const addDays = (days: number) => toLocalDateString(new Date(Date.now() + days * 86400000));

interface OpenBookingsCardProps {
  businessId: string;
  onShowAll: () => void;
}

/**
 * Dashboard "Zu erledigen": bookings that still need confirming, checking in or
 * paying, and gift card orders waiting to be paid in the shop. Each row says what
 * is open and has one button; everything is edited in the popup.
 */
export default function OpenBookingsCard({ businessId, onShowAll }: OpenBookingsCardProps) {
  const { t, locale } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<OpenBooking[]>([]);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<Opened>(null);
  const today = toLocalDateString(new Date());

  const load = useCallback(async () => {
    if (!businessId) return;
    const [bookingRes, orderRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, start_time, status, payment_status, customer_name, final_amount_cents, service:services(name), duration:service_durations(price_cents), payments:booking_payments(method, amount_cents, voided_at, gift_card_id)')
        .eq('business_id', businessId)
        .in('status', ['pending', 'confirmed', 'completed'])
        .or('no_show.is.null,no_show.eq.false')
        .gte('booking_date', addDays(-LOOKBACK_DAYS))
        .lte('booking_date', addDays(LOOKAHEAD_DAYS))
        .order('booking_date')
        .order('start_time'),
      supabase
        .from('gift_card_orders')
        .select('id, order_number, title, total_cents, buyer_name')
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

  const open = bookings
    .map((booking) => ({ booking, step: stepOf(booking, today) }))
    .filter((row): row is { booking: OpenBooking; step: 1 | 2 | 3 } => row.step !== 'done' && row.step !== 'wait');
  const total = open.length + orders.length;
  const popup = opened?.kind === 'booking'
    ? <BookingTaskModal bookingId={opened.id} onClose={() => setOpened(null)} onChanged={load} />
    : opened?.kind === 'order'
      ? <OrderTaskModal orderId={opened.id} onClose={() => setOpened(null)} onChanged={load} />
      : null;
  if (!error && total === 0) return popup;

  const day = (date: string) => (date === today ? t.today : new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }));
  const stepLabel = { 1: t.needsConfirm, 2: t.needsAttendance, 3: t.notPaid } as const;
  const editButton = (kind: 'booking' | 'order', id: string) => (
    <button type="button" onClick={() => setOpened({ kind, id })} className={`${ADMIN_SECONDARY_BUTTON} shrink-0`}>{t.edit}</button>
  );

  return (
    <section className={`${ADMIN_SURFACE} p-5`} aria-labelledby="todo-title">
      <h2 id="todo-title" className="mb-2 text-[15px] font-semibold text-[#1A1714]">
        {t.title} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{total}</span>
      </h2>
      {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-stone-200/70">
        {open.slice(0, SHOWN).map(({ booking: b, step }) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#1A1714]">{b.customer_name}</p>
              <p className="truncate text-xs text-stone-500">{day(b.booking_date)} · {b.start_time.slice(0, 5)} · {b.service?.name} · {formatPrice(b.final_amount_cents ?? b.duration?.price_cents ?? 0)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={STATUS_PILL}>{stepLabel[step]}</span>
              {editButton('booking', b.id)}
            </div>
          </li>
        ))}
        {orders.map((order) => (
          <li key={order.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Gift className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1A1714]">{order.buyer_name}</p>
                <p className="truncate text-xs text-stone-500">{t.orderNumber} <span className="font-mono tracking-wider">{order.order_number}</span> · {order.title} · {formatPrice(order.total_cents)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={STATUS_PILL}>{t.orderNotPaid}</span>
              {editButton('order', order.id)}
            </div>
          </li>
        ))}
      </ul>
      {open.length > SHOWN && (
        <button type="button" onClick={onShowAll} className="mt-2 text-sm font-medium text-stone-600 underline-offset-2 hover:text-[#1A1714] hover:underline">
          {fillText(t.more, { count: open.length - SHOWN })}
        </button>
      )}
      {popup}
    </section>
  );
}
