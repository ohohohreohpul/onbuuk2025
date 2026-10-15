import { useCallback, useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';
import { toLocalDateString } from '../../lib/localDateTime';
import { ADMIN_SURFACE } from './adminUi';
import QuickPay, { STEP_SELECT_DONE, STEP_SELECT_OPEN } from './bookings/QuickPay';
import RecordPaymentModal from './bookings/RecordPaymentModal';
import { markBookingNoShow, setBookingStatus } from './bookings/bookingActions';
import type { BookingPayment } from './bookings/paymentMethods';
import { openCentsOf, stepOf } from './bookings/bookingSteps';
import { markOrderPaid, type ShopPaymentMethod } from './giftCardOrders/giftCardOrdersApi';
import OrderPaySelect from './giftCardOrders/OrderPaySelect';

const TEXT: Translations<{
  title: string; today: string; more: string; loadFailed: string; actionFailed: string;
  confirmation: string; attendance: string; payment: string; stillOpen: string; notPaid: string;
  confirmYes: string; confirmNo: string; confirmedDone: string; reset: string; cancelBooking: string; showYes: string; showNo: string; showedDone: string;
  paidCash: string; paidCard: string;
  declineConfirm: string; noShowConfirm: string; voucherOrder: string; orderNumber: string; voucherCodes: string;
}> = {
  en: {
    title: 'To do', today: 'Today', more: '{count} more in Bookings', loadFailed: 'Could not load open items.', actionFailed: 'Could not save. Please try again.',
    confirmation: 'Confirmation', attendance: 'Attendance', payment: 'Payment', stillOpen: 'Still open', notPaid: 'Not paid',
    confirmYes: 'Yes, confirm', confirmNo: 'No, decline', confirmedDone: 'Confirmed', reset: 'Back to: still open', cancelBooking: 'Cancel booking', showYes: 'Yes, showed up', showNo: 'No, did not come', showedDone: 'Showed up',
    paidCash: 'Paid cash', paidCard: 'Paid by card',
    declineConfirm: 'Decline the booking of {name}? The customer is informed by email.', noShowConfirm: 'Mark {name} as no-show?',
    voucherOrder: 'Gift card order {code}', orderNumber: 'Order', voucherCodes: 'Voucher code (valid after payment): {codes}',
  },
  de: {
    title: 'Zu erledigen', today: 'Heute', more: '{count} weitere unter Buchungen', loadFailed: 'Offene Punkte konnten nicht geladen werden.', actionFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    confirmation: 'Bestätigung', attendance: 'Erscheinen', payment: 'Zahlung', stillOpen: 'Noch offen', notPaid: 'Nicht bezahlt',
    confirmYes: 'Ja, bestätigen', confirmNo: 'Nein, ablehnen', confirmedDone: 'Bestätigt', reset: 'Zurück auf: noch offen', cancelBooking: 'Absagen', showYes: 'Ja, erschienen', showNo: 'Nein, nicht erschienen', showedDone: 'Erschienen',
    paidCash: 'Bar bezahlt', paidCard: 'Mit Karte bezahlt',
    declineConfirm: 'Buchung von {name} ablehnen? Die Kundin bzw. der Kunde wird per E-Mail informiert.', noShowConfirm: '{name} als nicht erschienen eintragen?',
    voucherOrder: 'Gutschein-Bestellung {code}', orderNumber: 'Bestellung', voucherCodes: 'Gutscheincode (gültig nach Zahlung): {codes}',
  },
  th: {
    title: 'สิ่งที่ต้องทำ', today: 'วันนี้', more: 'อีก {count} รายการในหน้าการจอง', loadFailed: 'โหลดรายการไม่สำเร็จ', actionFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    confirmation: 'การยืนยัน', attendance: 'การมาตามนัด', payment: 'การชำระเงิน', stillOpen: 'ยังไม่ดำเนินการ', notPaid: 'ยังไม่ชำระ',
    confirmYes: 'ใช่ ยืนยัน', confirmNo: 'ไม่ ปฏิเสธ', confirmedDone: 'ยืนยันแล้ว', reset: 'กลับเป็น: ยังไม่ดำเนินการ', cancelBooking: 'ยกเลิกการจอง', showYes: 'ใช่ ลูกค้ามา', showNo: 'ไม่ ลูกค้าไม่มา', showedDone: 'ลูกค้ามาแล้ว',
    paidCash: 'ชำระเงินสดแล้ว', paidCard: 'ชำระด้วยบัตรแล้ว',
    declineConfirm: 'ปฏิเสธการจองของ {name}? ลูกค้าจะได้รับอีเมลแจ้ง', noShowConfirm: 'บันทึกว่า {name} ไม่มาตามนัด?',
    voucherOrder: 'คำสั่งซื้อบัตรของขวัญ {code}', orderNumber: 'คำสั่งซื้อ', voucherCodes: 'รหัสบัตร (ใช้ได้หลังชำระเงิน): {codes}',
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
  gift_cards: { code: string }[] | null;
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
        .select('id, order_number, title, total_cents, buyer_name, created_at, gift_cards(code)')
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
    if (value === 'reset') run(b.id, () => setBookingStatus(b.id, 'pending'));
    if (value === 'yes') run(b.id, () => setBookingStatus(b.id, 'confirmed'));
    if (value === 'no' && confirm(fillText(t.declineConfirm, { name: b.customer_name }))) run(b.id, () => setBookingStatus(b.id, 'cancelled'));
  };
  const onShowedUp = (b: OpenBooking, value: string) => {
    if (value === 'reset') run(b.id, () => setBookingStatus(b.id, 'confirmed'));
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
  /**
   * One step as a dropdown that always names the current state. Open = amber with the
   * two answers; done = green "✓ …" that can still be changed or set back; not reached = grey.
   */
  const stepChoice = (
    state: 'open' | 'done' | 'locked', busy: boolean, onChange: (value: string) => void,
    texts: { done: string; yes: string; no: string; noWhenDone: string; canReset: boolean },
  ) => {
    if (state === 'done') {
      return (
        <select value="yes" disabled={busy} onChange={(e) => onChange(e.target.value)} aria-label={texts.done}
          className={STEP_SELECT_DONE}>
          <option value="yes">✓ {texts.done}</option>
          {texts.canReset && <option value="reset">{t.reset}</option>}
          <option value="no">{texts.noWhenDone}</option>
        </select>
      );
    }
    return (
      <select value="" disabled={state === 'locked' || busy} onChange={(e) => onChange(e.target.value)} className={STEP_SELECT_OPEN}>
        <option value="" disabled>{t.stillOpen}</option>
        <option value="yes">{texts.yes}</option>
        <option value="no">{texts.no}</option>
      </select>
    );
  };
  const stateOf = (step: number, own: number): 'open' | 'done' | 'locked' => (step > own ? 'done' : step === own ? 'open' : 'locked');

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
                <Step label={t.confirmation}>
                  {stepChoice(stateOf(step, 1), busy, (v) => onConfirm(b, v), { done: t.confirmedDone, yes: t.confirmYes, no: t.confirmNo, noWhenDone: t.cancelBooking, canReset: step === 2 })}
                </Step>
                <Step label={t.attendance} muted={step < 2}>
                  {stepChoice(stateOf(step, 2), busy, (v) => onShowedUp(b, v), { done: t.showedDone, yes: t.showYes, no: t.showNo, noWhenDone: t.showNo, canReset: true })}
                </Step>
                <Step label={t.payment} muted={step < 3}>
                  <QuickPay asSelect label={t.payment} disabled={step !== 3 || busy} bookingId={b.id} openCents={openCentsOf(b)} onOther={() => setPaying(b)} onPaid={load} />
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
                <p className="truncate text-sm font-semibold text-[#1A1714]">
                  {order.buyer_name} · <span className="font-normal text-stone-500">{t.orderNumber}</span> <span className="font-mono tracking-wider">{order.order_number}</span>
                </p>
                <p className="truncate text-xs text-stone-500">{order.title} · {formatPrice(order.total_cents)}</p>
                {(order.gift_cards ?? []).length > 0 && (
                  <p className="truncate text-xs text-stone-500">{fillText(t.voucherCodes, { codes: (order.gift_cards ?? []).map((card) => card.code).join(', ') })}</p>
                )}
              </div>
            </div>
            <OrderPaySelect busy={busyId === order.id} onPaid={(method) => onOrderPaid(order, method)} />
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
