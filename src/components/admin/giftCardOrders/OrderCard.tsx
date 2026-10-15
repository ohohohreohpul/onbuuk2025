import { useState } from 'react';
import { Download, Gift, Loader2, Mail, Phone } from 'lucide-react';
import { useCurrency } from '../../../lib/currencyContext';
import {
  ADMIN_SECONDARY_BUTTON,
  ADMIN_STATUS_PILL,
  ADMIN_SURFACE,
} from '../adminUi';
import type { GiftCardOrder } from './giftCardOrdersApi';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, Translations } from '../../../lib/bookingLanguage';

type OrderCardText = {
  statusPending: string; statusPaid: string; statusCancelled: string;
  valueVoucher: string; treatment: string; visits: string;
  ordered: string; edit: string; printVouchers: string;
  handedOverOn: string; tickWhenHanded: string; recipientFor: string;
  voucherOne: string; voucherMany: string; afterPayment: string;
};

const TEXT: Translations<OrderCardText> = {
  en: {
    statusPending: 'Awaiting payment', statusPaid: 'Paid', statusCancelled: 'Cancelled',
    valueVoucher: 'Value voucher · {amount}', treatment: 'Treatment', visits: '{count} visits',
    ordered: 'ordered {date}', edit: 'Open',
    printVouchers: 'Print vouchers (PDF)', handedOverOn: 'Handed over {date}', tickWhenHanded: 'Tick when handed over',
    recipientFor: 'For: {email}', voucherOne: '1 voucher', voucherMany: '{count} vouchers', afterPayment: 'valid after payment',
  },
  de: {
    statusPending: 'Zahlung offen', statusPaid: 'Bezahlt', statusCancelled: 'Storniert',
    valueVoucher: 'Wertgutschein · {amount}', treatment: 'Behandlung', visits: '{count} Besuche',
    ordered: 'bestellt am {date}', edit: 'Bearbeiten',
    printVouchers: 'Gutscheine drucken (PDF)', handedOverOn: 'Übergeben am {date}', tickWhenHanded: 'Bei Übergabe abhaken',
    recipientFor: 'Für: {email}', voucherOne: '1 Gutschein', voucherMany: '{count} Gutscheine', afterPayment: 'gültig nach Zahlung',
  },
  th: {
    statusPending: 'รอชำระเงิน', statusPaid: 'ชำระแล้ว', statusCancelled: 'ยกเลิกแล้ว',
    valueVoucher: 'บัตรของขวัญแบบมูลค่า · {amount}', treatment: 'ทรีตเมนต์', visits: '{count} ครั้ง',
    ordered: 'สั่งซื้อเมื่อ {date}', edit: 'แก้ไข',
    printVouchers: 'พิมพ์บัตรของขวัญ (PDF)', handedOverOn: 'ส่งมอบแล้วเมื่อ {date}', tickWhenHanded: 'ติ๊กเมื่อส่งมอบแล้ว',
    recipientFor: 'ผู้รับ: {email}', voucherOne: 'บัตรของขวัญ 1 ใบ', voucherMany: 'บัตรของขวัญ {count} ใบ', afterPayment: 'ใช้ได้หลังชำระเงิน',
  },
};

interface OrderCardProps {
  order: GiftCardOrder;
  isBusy: boolean;
  /** Opens the order popup (record payment, cancel). */
  onOpen: () => void;
  onToggleBonus: (isHanded: boolean) => void;
  onDownload: () => void;
}

const STATUS_STYLE: Record<GiftCardOrder['status'], { labelKey: keyof OrderCardText; className: string }> = {
  pending_payment: { labelKey: 'statusPending', className: 'bg-amber-50 text-amber-800' },
  paid: { labelKey: 'statusPaid', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { labelKey: 'statusCancelled', className: 'bg-stone-900/[0.05] text-stone-500' },
};

function voucherLine(
  card: GiftCardOrder['gift_cards'][number],
  formatAmount: (value: number) => string,
  t: OrderCardText,
): string {
  if (card.card_type === 'value') return fillText(t.valueVoucher, { amount: formatAmount(card.original_value_cents / 100) });
  const visits = card.original_visits ?? 1;
  return `${card.service_pass_name ?? t.treatment}${visits > 1 ? ` · ${fillText(t.visits, { count: visits })}` : ''}`;
}

export default function OrderCard({ order, isBusy, onOpen, onToggleBonus, onDownload }: OrderCardProps) {
  const { formatAmount } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const [isExpanded, setIsExpanded] = useState(order.status === 'pending_payment');
  const status = STATUS_STYLE[order.status];
  const isPaid = order.status === 'paid';

  return (
    <article className={`${ADMIN_SURFACE} p-5`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => setIsExpanded((value) => !value)} aria-expanded={isExpanded}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-semibold tracking-[0.18em] text-[#1A1714]">{order.order_number}</span>
            <span className={`${ADMIN_STATUS_PILL} ${status.className}`}>{t[status.labelKey]}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-stone-800">{order.title} · {formatAmount(order.total_cents / 100)}</p>
          <p className="text-xs text-stone-500">
            {order.buyer_name} · {fillText(t.ordered, { date: new Date(order.created_at).toLocaleString(locale) })}
          </p>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'pending_payment' && (
            <button type="button" className={ADMIN_SECONDARY_BUTTON} disabled={isBusy} onClick={onOpen}>{t.edit}</button>
          )}
          {isPaid && (
            <button type="button" className={ADMIN_SECONDARY_BUTTON} disabled={isBusy} onClick={onDownload}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t.printVouchers}
            </button>
          )}
        </div>
      </header>

      {order.bonus_note && order.status !== 'cancelled' && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-[#F3EADF]/70 px-4 py-3 text-sm text-[#5C4630]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[#7A5A3A]"
            checked={Boolean(order.bonus_handed_at)}
            disabled={isBusy}
            onChange={(event) => onToggleBonus(event.target.checked)}
          />
          <span>
            <span className="flex items-center gap-1.5 font-medium"><Gift className="h-4 w-4" aria-hidden="true" /> {order.bonus_note}</span>
            <span className="block text-xs text-[#7A5A3A]/80">
              {order.bonus_handed_at
                ? fillText(t.handedOverOn, { date: new Date(order.bonus_handed_at).toLocaleDateString(locale) })
                : t.tickWhenHanded}
            </span>
          </span>
        </label>
      )}

      {isExpanded && (
        <div className="mt-4 grid gap-4 border-t border-stone-200/70 pt-4 text-sm md:grid-cols-2">
          <div className="space-y-1.5 text-stone-600">
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-stone-400" /> {order.buyer_email}</p>
            {order.buyer_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-stone-400" /> {order.buyer_phone}</p>}
            {order.recipient_email && <p className="text-xs text-stone-500">{fillText(t.recipientFor, { email: order.recipient_email })}</p>}
            {order.message && <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs italic text-stone-500">“{order.message}”</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              {order.gift_cards.length === 1 ? t.voucherOne : fillText(t.voucherMany, { count: order.gift_cards.length })}
            </p>
            <ul className="space-y-1.5">
              {order.gift_cards.map((card) => (
                <li key={card.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2">
                  <span className="truncate text-stone-700">{voucherLine(card, formatAmount, t)}</span>
                  <span className="shrink-0 text-right font-mono text-xs text-stone-500">
                    {card.code}
                    {!isPaid && order.status !== 'cancelled' && <span className="block font-sans text-[10px] text-amber-700">{t.afterPayment}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
