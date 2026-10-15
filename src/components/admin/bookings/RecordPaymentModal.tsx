import { useCallback, useEffect, useState } from 'react';
import { Banknote, CreditCard, Gift, MoreHorizontal, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import {
  ADMIN_INPUT, ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON,
  ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE,
} from '../adminUi';
import { BookingPayment, PAYMENT_METHOD_LABELS, openAmountCents } from './paymentMethods';
import PaymentRow from './PaymentRow';

type Choice = 'cash' | 'card' | 'gift_card' | 'other';

const TEXT: Translations<{
  title: string; close: string; price: string; open: string; paid: string; paidInFull: string; howPaid: string;
  amount: string; voucherCode: string; voucherHint: string; record: string; recording: string; done: string;
  coveredByVoucher: string; markPaid: string; loadFailed: string; recordFailed: string; voucherFailed: string;
  invalidAmount: string; tooMuch: string;
}> = {
  en: {
    title: 'Record payment', close: 'Close', price: 'Price', open: 'Still open', paid: 'Already paid',
    paidInFull: 'Paid in full', howPaid: 'How did the customer pay?', amount: 'Amount ({symbol})',
    voucherCode: 'Voucher number (optional)', voucherHint: 'If the number is a Zenno gift card, its balance is reduced too.',
    record: 'Record payment', recording: 'Saving…', done: 'Done', coveredByVoucher: 'Gift cards cover the full price.',
    markPaid: 'Mark as paid', loadFailed: 'Could not load the payments for this booking.', recordFailed: 'Could not record the payment.',
    voucherFailed: 'Could not redeem the card: {reason}', invalidAmount: 'Enter an amount greater than 0.', tooMuch: 'That is more than the open amount of {amount}.',
  },
  de: {
    title: 'Zahlung erfassen', close: 'Schließen', price: 'Preis', open: 'Noch offen', paid: 'Bereits bezahlt',
    paidInFull: 'Vollständig bezahlt', howPaid: 'Wie wurde bezahlt?', amount: 'Betrag ({symbol})',
    voucherCode: 'Gutschein-Nummer (optional)', voucherHint: 'Ist es ein Zenno-Gutschein, wird auch das Guthaben abgebucht.',
    record: 'Zahlung erfassen', recording: 'Wird gespeichert…', done: 'Fertig', coveredByVoucher: 'Gutscheine decken den vollen Preis.',
    markPaid: 'Als bezahlt markieren', loadFailed: 'Zahlungen dieser Buchung konnten nicht geladen werden.', recordFailed: 'Zahlung konnte nicht erfasst werden.',
    voucherFailed: 'Gutschein konnte nicht eingelöst werden: {reason}', invalidAmount: 'Bitte einen Betrag größer als 0 eingeben.', tooMuch: 'Das ist mehr als der offene Betrag von {amount}.',
  },
  th: {
    title: 'บันทึกการชำระเงิน', close: 'ปิด', price: 'ราคา', open: 'ยอดค้างชำระ', paid: 'ชำระแล้ว',
    paidInFull: 'ชำระครบแล้ว', howPaid: 'ลูกค้าชำระด้วยวิธีใด', amount: 'จำนวนเงิน ({symbol})',
    voucherCode: 'เลขที่บัตรของขวัญ (ไม่บังคับ)', voucherHint: 'ถ้าเป็นบัตรของขวัญในระบบ Zenno ระบบจะหักยอดในบัตรด้วย',
    record: 'บันทึกการชำระ', recording: 'กำลังบันทึก…', done: 'เสร็จสิ้น', coveredByVoucher: 'บัตรของขวัญครอบคลุมราคาทั้งหมดแล้ว',
    markPaid: 'ทำเครื่องหมายว่าชำระแล้ว', loadFailed: 'โหลดข้อมูลการชำระเงินของการจองนี้ไม่สำเร็จ', recordFailed: 'บันทึกการชำระเงินไม่สำเร็จ',
    voucherFailed: 'ใช้บัตรไม่สำเร็จ: {reason}', invalidAmount: 'กรุณาใส่จำนวนเงินที่มากกว่า 0', tooMuch: 'จำนวนนี้มากกว่ายอดค้างชำระ {amount}',
  },
};

const CHOICES: { value: Choice; icon: typeof Banknote }[] = [
  { value: 'cash', icon: Banknote },
  { value: 'card', icon: CreditCard },
  { value: 'gift_card', icon: Gift },
  { value: 'other', icon: MoreHorizontal },
];

export interface PayableBooking {
  id: string;
  customer_name: string;
}

interface RecordPaymentModalProps {
  booking: PayableBooking;
  onClose: () => void;
  /** Called after any change, so the list behind can refresh. */
  onChanged: () => void;
}

const parseCents = (value: string): number => Math.round(parseFloat(value.replace(',', '.')) * 100);

export default function RecordPaymentModal({ booking, onClose, onChanged }: RecordPaymentModalProps) {
  const { t, lang } = useAdminText(TEXT);
  const methodLabels = PAYMENT_METHOD_LABELS[lang];
  const { formatPrice, currencySymbol: symbol } = useCurrency();

  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const [finalAmountCents, setFinalAmountCents] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Choice>('cash');
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [bookingRes, paymentsRes] = await Promise.all([
      supabase.from('bookings').select('final_amount_cents, payment_status').eq('id', booking.id).maybeSingle(),
      supabase.from('booking_payments').select('*').eq('booking_id', booking.id).is('voided_at', null).order('created_at'),
    ]);
    if (bookingRes.error || paymentsRes.error) {
      console.error('Could not load booking payments:', bookingRes.error || paymentsRes.error);
      setError(t.loadFailed);
      setLoading(false);
      return;
    }
    const rows = (paymentsRes.data ?? []) as BookingPayment[];
    const due = Number(bookingRes.data?.final_amount_cents ?? 0);
    setPayments(rows);
    setFinalAmountCents(due);
    setIsPaid(bookingRes.data?.payment_status === 'completed');
    setAmount((openAmountCents(due, rows) / 100).toFixed(2));
    setLoading(false);
  }, [booking.id, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  const open = openAmountCents(finalAmountCents, payments);
  const paidTotal = payments.reduce((sum, payment) => sum + payment.amount_cents, 0);

  /** Zenno voucher: redeem it (balance + link). Returns null when the number is not a Zenno voucher. */
  const redeemZennoVoucher = async (cents: number): Promise<{ handled: boolean; failure: string | null }> => {
    const { error: redeemError } = await supabase.rpc('redeem_gift_card_for_booking', {
      p_booking_id: booking.id,
      p_code: code.trim(),
      p_requested_amount_cents: cents,
    });
    if (!redeemError) return { handled: true, failure: null };
    // Paper voucher or other number Zenno does not know: record it as a plain voucher payment.
    if (/invalid gift card/i.test(redeemError.message)) return { handled: false, failure: null };
    return { handled: true, failure: fillText(t.voucherFailed, { reason: redeemError.message }) };
  };

  const recordCounterPayment = async (method: Choice, cents: number, reference?: string) => {
    const { error: recordError } = await supabase.rpc('record_shop_payment', {
      p_booking_id: booking.id,
      p_method: method,
      p_amount_cents: cents,
      p_reference: reference || null,
    });
    if (recordError) console.error('Could not record shop payment:', recordError);
    return recordError ? t.recordFailed : null;
  };

  const handleRecord = async () => {
    const cents = parseCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) { setError(t.invalidAmount); return; }
    if (cents > open) { setError(fillText(t.tooMuch, { amount: formatPrice(open) })); return; }

    setSaving(true);
    setError('');
    let failure: string | null;
    if (choice === 'gift_card' && code.trim()) {
      const zenno = await redeemZennoVoucher(cents);
      failure = zenno.handled ? zenno.failure : await recordCounterPayment('gift_card', cents, code.trim());
      // A Zenno voucher lowers the price; if nothing is left, close the booking.
      if (zenno.handled && !failure) failure = await recordCounterPayment('other', 0);
    } else {
      failure = await recordCounterPayment(choice, cents);
    }
    setSaving(false);
    if (failure) { setError(failure); return; }
    setCode('');
    onChanged();
    await load();
  };

  const handleSettle = async () => {
    setSaving(true);
    const failure = await recordCounterPayment('other', 0);
    setSaving(false);
    if (failure) { setError(failure); return; }
    onChanged();
    await load();
  };

  const showForm = !loading && open > 0;

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="record-payment-title">
      <div className={`${ADMIN_MODAL} max-w-md p-6`}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="record-payment-title" className="text-lg font-semibold text-[#1A1714]">{t.title}</h2>
            <p className="mt-0.5 text-sm text-stone-500">{booking.customer_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-stone-400">…</div>
        ) : (
          <>
            <dl className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/80 p-3.5 ring-1 ring-stone-900/[0.05]">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{t.paid}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-[#1A1714]">{formatPrice(paidTotal)}</dd>
              </div>
              <div className={`rounded-2xl p-3.5 ring-1 ${open > 0 ? 'bg-amber-50 ring-amber-200/70' : 'bg-emerald-50 ring-emerald-200/70'}`}>
                <dt className={`text-[11px] font-medium uppercase tracking-wide ${open > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{open > 0 ? t.open : t.paidInFull}</dt>
                <dd className={`mt-1 text-lg font-semibold tabular-nums ${open > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>{formatPrice(open)}</dd>
              </div>
            </dl>

            {payments.length > 0 && (
              <ul className="mb-5 divide-y divide-stone-200/70 rounded-2xl bg-white/70 ring-1 ring-stone-900/[0.05]">
                {payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} onCorrected={() => { onChanged(); load(); }} />
                ))}
              </ul>
            )}

            {showForm && (
              <div className="space-y-4">
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-stone-700">{t.howPaid}</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {CHOICES.map(({ value, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={choice === value}
                        onClick={() => { setChoice(value); setError(''); }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 ${choice === value ? `${ADMIN_SEGMENT_ACTIVE} ring-transparent` : `${ADMIN_SEGMENT_INACTIVE} bg-white/70 ring-stone-200/80`}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {value === 'card' ? methodLabels.card.split(' (')[0] : methodLabels[value]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {choice === 'gift_card' && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-stone-700">{t.voucherCode}</span>
                    <input value={code} onChange={(e) => setCode(e.target.value)} className={`${ADMIN_INPUT} font-mono uppercase`} placeholder="GC-XXXX-XXXX-XXXX" autoFocus />
                    <span className="mt-1.5 block text-xs text-stone-500">{t.voucherHint}</span>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-stone-700">{fillText(t.amount, { symbol })}</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${ADMIN_INPUT} tabular-nums`} />
                </label>
              </div>
            )}

            {!loading && open === 0 && !isPaid && (
              <p className="mb-4 text-sm text-stone-600">{t.coveredByVoucher}</p>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{showForm ? t.close : t.done}</button>
              {showForm && (
                <button type="button" onClick={handleRecord} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
                  {saving ? t.recording : t.record}
                </button>
              )}
              {!showForm && !loading && open === 0 && !isPaid && (
                <button type="button" onClick={handleSettle} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>{t.markPaid}</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
