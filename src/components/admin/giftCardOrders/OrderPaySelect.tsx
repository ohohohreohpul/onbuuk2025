import { Loader2 } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { STEP_SELECT_OPEN } from '../bookings/QuickPay';
import type { ShopPaymentMethod } from './giftCardOrdersApi';

const TEXT: Translations<{ label: string; notPaid: string; paidCash: string; paidCard: string }> = {
  en: { label: 'Payment', notPaid: 'Not paid', paidCash: 'Paid cash', paidCard: 'Paid by card' },
  de: { label: 'Zahlung', notPaid: 'Nicht bezahlt', paidCash: 'Bar bezahlt', paidCard: 'Mit Karte bezahlt' },
  th: { label: 'การชำระเงิน', notPaid: 'ยังไม่ชำระ', paidCash: 'ชำระเงินสดแล้ว', paidCard: 'ชำระด้วยบัตรแล้ว' },
};

interface OrderPaySelectProps {
  busy: boolean;
  onPaid: (method: ShopPaymentMethod) => void;
}

/** The same "Nicht bezahlt ▾" dropdown wherever a gift card order is paid in the shop. */
export default function OrderPaySelect({ busy, onPaid }: OrderPaySelectProps) {
  const { t } = useAdminText(TEXT);
  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-xs font-medium text-stone-500">{t.label}</span>
      <select value="" disabled={busy} className={STEP_SELECT_OPEN}
        onChange={(e) => { if (e.target.value === 'cash' || e.target.value === 'card') onPaid(e.target.value); }}>
        <option value="" disabled>{t.notPaid}</option>
        <option value="cash">{t.paidCash}</option>
        <option value="card">{t.paidCard}</option>
      </select>
      {busy && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
    </label>
  );
}
