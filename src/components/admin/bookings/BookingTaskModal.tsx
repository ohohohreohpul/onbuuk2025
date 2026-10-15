import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import { toLocalDateString } from '../../../lib/localDateTime';
import { ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import QuickPay from './QuickPay';
import RecordPaymentModal from './RecordPaymentModal';
import PaymentSummary from './PaymentSummary';
import { markBookingNoShow, setBookingStatus } from './bookingActions';
import { openCentsOf, stepOf } from './bookingSteps';
import type { BookingPayment, PaymentMethod } from './paymentMethods';

const TEXT: Translations<{
  more: string; close: string; loadFailed: string; actionFailed: string; cancelled: string;
  confirmation: string; attendance: string; payment: string;
  confirmOpen: string; confirm: string; decline: string; confirmedDone: string;
  attendanceWait: string; attendanceOpen: string; showedUp: string; noShow: string; showedDone: string;
  paymentWait: string; paidDone: string; undo: string;
  declineConfirm: string; noShowConfirm: string; noShowFee: string; noShowCharged: string; cancelConfirm: string; cancelBooking: string;
}> = {
  en: {
    more: 'More', close: 'Close', loadFailed: 'Could not load the booking.', actionFailed: 'Could not save. Please try again.', cancelled: 'This booking is cancelled.',
    confirmation: '1 · Confirmation', attendance: '2 · Did the customer come?', payment: '3 · Payment',
    confirmOpen: 'The customer is waiting for your confirmation.', confirm: 'Confirm booking', decline: 'Decline', confirmedDone: 'Confirmed',
    attendanceWait: 'Can be entered on the day of the appointment.', attendanceOpen: 'Please enter whether the customer came.', showedUp: 'Yes, came', noShow: 'No, did not come', showedDone: 'Customer came',
    paymentWait: 'Available once the customer has come.', paidDone: 'Paid', undo: 'Undo',
    declineConfirm: 'Decline the booking of {name}? The customer is informed by email.', noShowConfirm: 'Mark {name} as no-show?', noShowFee: 'A no-show fee of {fee} applies.', noShowCharged: 'No-show fee of {amount} was charged.',
    cancelConfirm: 'Cancel the booking of {name}? The customer is informed by email.', cancelBooking: 'Cancel booking',
  },
  de: {
    more: 'Weitere Aktionen', close: 'Schließen', loadFailed: 'Buchung konnte nicht geladen werden.', actionFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', cancelled: 'Diese Buchung ist storniert.',
    confirmation: '1 · Bestätigung', attendance: '2 · Ist die Kundin / der Kunde gekommen?', payment: '3 · Zahlung',
    confirmOpen: 'Die Kundin / der Kunde wartet auf Ihre Bestätigung.', confirm: 'Buchung bestätigen', decline: 'Ablehnen', confirmedDone: 'Bestätigt',
    attendanceWait: 'Kann am Tag des Termins eingetragen werden.', attendanceOpen: 'Bitte eintragen, ob die Kundin / der Kunde gekommen ist.', showedUp: 'Ja, gekommen', noShow: 'Nein, nicht gekommen', showedDone: 'Gekommen',
    paymentWait: 'Möglich, sobald die Kundin / der Kunde gekommen ist.', paidDone: 'Bezahlt', undo: 'Rückgängig',
    declineConfirm: 'Buchung von {name} ablehnen? Die Kundin bzw. der Kunde wird per E-Mail informiert.', noShowConfirm: '{name} als nicht gekommen eintragen?', noShowFee: 'Es fällt eine No-Show-Gebühr von {fee} an.', noShowCharged: 'No-Show-Gebühr von {amount} wurde abgebucht.',
    cancelConfirm: 'Buchung von {name} absagen? Die Kundin bzw. der Kunde wird per E-Mail informiert.', cancelBooking: 'Buchung absagen',
  },
  th: {
    more: 'การดำเนินการเพิ่มเติม', close: 'ปิด', loadFailed: 'โหลดการจองไม่สำเร็จ', actionFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', cancelled: 'การจองนี้ถูกยกเลิกแล้ว',
    confirmation: '1 · การยืนยัน', attendance: '2 · ลูกค้ามาหรือไม่?', payment: '3 · การชำระเงิน',
    confirmOpen: 'ลูกค้ากำลังรอการยืนยันจากคุณ', confirm: 'ยืนยันการจอง', decline: 'ปฏิเสธ', confirmedDone: 'ยืนยันแล้ว',
    attendanceWait: 'บันทึกได้ในวันนัดหมาย', attendanceOpen: 'กรุณาบันทึกว่าลูกค้ามาหรือไม่', showedUp: 'ใช่ ลูกค้ามา', noShow: 'ไม่ ลูกค้าไม่มา', showedDone: 'ลูกค้ามาแล้ว',
    paymentWait: 'ทำได้หลังจากลูกค้ามาแล้ว', paidDone: 'ชำระแล้ว', undo: 'ย้อนกลับ',
    declineConfirm: 'ปฏิเสธการจองของ {name}? ลูกค้าจะได้รับอีเมลแจ้ง', noShowConfirm: 'บันทึกว่า {name} ไม่มาตามนัด?', noShowFee: 'มีค่าธรรมเนียมไม่มาตามนัด {fee}', noShowCharged: 'เรียกเก็บค่าธรรมเนียมไม่มาตามนัด {amount} แล้ว',
    cancelConfirm: 'ยกเลิกการจองของ {name}? ลูกค้าจะได้รับอีเมลแจ้ง', cancelBooking: 'ยกเลิกการจอง',
  },
};

interface TaskBooking {
  id: string;
  business_id: string;
  booking_date: string;
  start_time: string;
  status: string;
  no_show: boolean | null;
  payment_status: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  final_amount_cents: number | null;
  service: { name: string; no_show_fee: number } | null;
  duration: { price_cents: number; duration_minutes: number } | null;
  payments: (BookingPayment & { method: PaymentMethod })[] | null;
}

interface BookingTaskModalProps {
  bookingId: string;
  onClose: () => void;
  /** Called after every change so the list behind refreshes. */
  onChanged: () => void;
  /** Rarer actions (move, invoice, delete …) shown as plain buttons at the bottom. */
  moreActions?: React.ReactNode;
}

/** The booking popup: confirm → came? → payment, each step with clear buttons. */
export default function BookingTaskModal({ bookingId, onClose, onChanged, moreActions }: BookingTaskModalProps) {
  const { t, locale } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const [booking, setBooking] = useState<TaskBooking | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentWindow, setPaymentWindow] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('bookings')
      .select('id, business_id, booking_date, start_time, status, no_show, payment_status, customer_name, customer_email, customer_phone, final_amount_cents, service:services(name, no_show_fee), duration:service_durations(price_cents, duration_minutes), payments:booking_payments(id, method, amount_cents, voided_at, gift_card_id, reference, created_at, booking_id)')
      .eq('id', bookingId)
      .maybeSingle();
    if (loadError || !data) {
      console.error('Could not load booking:', loadError);
      setError(t.loadFailed);
      return;
    }
    setBooking(data as unknown as TaskBooking);
  }, [bookingId, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      onChanged();
    } catch (actionError) {
      console.error('Booking action failed:', actionError);
      setError(t.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const ask = (template: string, action: () => Promise<unknown>) => {
    if (booking && confirm(fillText(template, { name: booking.customer_name }))) run(action);
  };

  const noShow = (b: TaskBooking) => {
    const fee = b.service?.no_show_fee ?? 0;
    const note = fee > 0 ? ` ${fillText(t.noShowFee, { fee: formatPrice(fee) })}` : '';
    if (!confirm(fillText(t.noShowConfirm, { name: b.customer_name }) + note)) return;
    run(async () => {
      const { chargedAmount } = await markBookingNoShow(b.business_id, b, `No-show for ${b.service?.name ?? ''} on ${b.booking_date} at ${b.start_time}`);
      if (chargedAmount !== null) alert(fillText(t.noShowCharged, { amount: formatPrice(chargedAmount) }));
    });
  };

  const step = booking ? stepOf(booking, toLocalDateString(new Date())) : null;
  const isCancelled = booking?.status === 'cancelled' || booking?.no_show;
  const doneMark = (text: string) => (
    <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" aria-hidden="true" />{text}</p>
  );

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="booking-task-title">
      <div className={`${ADMIN_MODAL} max-h-[90vh] max-w-lg overflow-y-auto`}>
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          {booking ? (
            <div>
              <h2 id="booking-task-title" className="text-xl font-semibold text-[#1A1714]">{booking.customer_name}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {new Date(`${booking.booking_date}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} · {booking.start_time.slice(0, 5)}
              </p>
              <p className="text-sm text-stone-500">{booking.service?.name} · {formatPrice(booking.final_amount_cents ?? booking.duration?.price_cents ?? 0)}</p>
            </div>
          ) : <h2 id="booking-task-title" className="sr-only">…</h2>}
          <button type="button" onClick={onClose} aria-label={t.close} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-900/[0.05] hover:text-stone-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 p-6">
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {!booking && !error && <Loader2 className="mx-auto h-5 w-5 animate-spin text-stone-400" />}
          {booking && isCancelled && <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">{t.cancelled}</p>}

          {booking && !isCancelled && step !== null && (
            <>
              <section className="rounded-2xl bg-[#F7F5F2] p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#1A1714]">{t.confirmation}</h3>
                {step === 1 ? (
                  <>
                    <p className="mb-3 text-sm text-stone-600">{t.confirmOpen}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => run(() => setBookingStatus(booking.id, 'confirmed'))} className={ADMIN_PRIMARY_BUTTON}>{t.confirm}</button>
                      <button type="button" disabled={busy} onClick={() => ask(t.declineConfirm, () => setBookingStatus(booking.id, 'cancelled'))} className={ADMIN_SECONDARY_BUTTON}>{t.decline}</button>
                    </div>
                  </>
                ) : doneMark(t.confirmedDone)}
              </section>

              <section className="rounded-2xl bg-[#F7F5F2] p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#1A1714]">{t.attendance}</h3>
                {step === 1 || step === 'wait' ? (
                  <p className="text-sm text-stone-500">{t.attendanceWait}</p>
                ) : step === 2 ? (
                  <>
                    <p className="mb-3 text-sm text-stone-600">{t.attendanceOpen}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => run(() => setBookingStatus(booking.id, 'completed'))} className={ADMIN_PRIMARY_BUTTON}>{t.showedUp}</button>
                      <button type="button" disabled={busy} onClick={() => noShow(booking)} className={ADMIN_SECONDARY_BUTTON}>{t.noShow}</button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {doneMark(t.showedDone)}
                    <button type="button" disabled={busy} onClick={() => run(() => setBookingStatus(booking.id, 'confirmed'))} className={ADMIN_TERTIARY_BUTTON}>{t.undo}</button>
                  </div>
                )}
              </section>

              <section className="rounded-2xl bg-[#F7F5F2] p-4">
                <h3 className="mb-2 text-sm font-semibold text-[#1A1714]">{t.payment}</h3>
                {step === 3 ? (
                  <QuickPay bookingId={booking.id} openCents={openCentsOf(booking)} onOther={() => setPaymentWindow(true)} onPaid={() => { load(); onChanged(); }} />
                ) : step === 'done' ? (
                  <div>{doneMark(t.paidDone)}<PaymentSummary booking={booking} onOpen={() => setPaymentWindow(true)} /></div>
                ) : (
                  <p className="text-sm text-stone-500">{t.paymentWait}</p>
                )}
              </section>

              {(step === 2 || step === 'wait') && (
                <div className="pt-1">
                  <button type="button" disabled={busy} onClick={() => ask(t.cancelConfirm, () => setBookingStatus(booking.id, 'cancelled'))} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50`}>{t.cancelBooking}</button>
                </div>
              )}
            </>
          )}
          {booking && moreActions && (
            <section className="border-t border-stone-200/70 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">{t.more}</h3>
              <div className="flex flex-wrap gap-2">{moreActions}</div>
            </section>
          )}
        </div>
      </div>
      {paymentWindow && booking && (
        <RecordPaymentModal booking={booking} onClose={() => setPaymentWindow(false)} onChanged={() => { load(); onChanged(); }} />
      )}
    </div>
  );
}
