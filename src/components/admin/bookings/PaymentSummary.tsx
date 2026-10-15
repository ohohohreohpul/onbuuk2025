import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { PAYMENT_METHOD_LABELS, PaymentMethod, totalsByMethod, type BookingPayment } from './paymentMethods';

const TEXT: Translations<{ unpaid: string; paidNoMethod: string; edit: string }> = {
  en: { unpaid: 'Not paid yet', paidNoMethod: 'Paid · method not recorded', edit: 'Record payment' },
  de: { unpaid: 'Noch nicht bezahlt', paidNoMethod: 'Bezahlt · Zahlart fehlt', edit: 'Zahlung erfassen' },
  th: { unpaid: 'ยังไม่ชำระ', paidNoMethod: 'ชำระแล้ว · ไม่ได้ระบุวิธีชำระ', edit: 'บันทึกการชำระเงิน' },
};

interface PaymentSummaryProps {
  booking: {
    payment_status: string | null;
    payments: { method: PaymentMethod; amount_cents: number }[] | null;
  };
  onOpen: () => void;
}

/** One line under the price: how the booking was paid, or that it is still open. */
export default function PaymentSummary({ booking, onOpen }: PaymentSummaryProps) {
  const { t, lang } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const rows = (booking.payments ?? []).map((payment, index) => ({
    ...payment, id: String(index), booking_id: '', reference: null, created_at: '',
  })) as BookingPayment[];
  const totals = totalsByMethod(rows).filter((total) => total.cents > 0);
  const isPaid = booking.payment_status === 'completed';

  const text = totals.length > 0
    ? totals.map((total) => `${PAYMENT_METHOD_LABELS[lang][total.method].split(' (')[0]} ${formatPrice(total.cents)}`).join(' + ')
    : isPaid ? t.paidNoMethod : t.unpaid;
  const tone = isPaid && totals.length > 0 ? 'text-emerald-700' : isPaid ? 'text-amber-700' : 'text-stone-400';

  return (
    <button
      type="button"
      onClick={onOpen}
      title={t.edit}
      className={`mt-1 block text-left text-[11px] font-medium ${tone} underline-offset-2 transition hover:underline focus-visible:underline focus-visible:outline-none`}
    >
      {text}
    </button>
  );
}
