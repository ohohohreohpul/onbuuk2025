import { useState } from 'react';
import { CheckCircle2, Download, Gift, Loader2, Mail, Phone, XCircle } from 'lucide-react';
import { useCurrency } from '../../../lib/currencyContext';
import {
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_STATUS_PILL,
  ADMIN_SURFACE,
  ADMIN_TERTIARY_BUTTON,
} from '../adminUi';
import type { GiftCardOrder } from './giftCardOrdersApi';

interface OrderCardProps {
  order: GiftCardOrder;
  isBusy: boolean;
  onMarkPaid: () => void;
  onCancel: () => void;
  onToggleBonus: (isHanded: boolean) => void;
  onDownload: () => void;
}

const STATUS_STYLE: Record<GiftCardOrder['status'], { label: string; className: string }> = {
  pending_payment: { label: 'Awaiting payment', className: 'bg-amber-50 text-amber-800' },
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-900/[0.05] text-stone-500' },
};

function voucherLine(card: GiftCardOrder['gift_cards'][number], formatAmount: (value: number) => string): string {
  if (card.card_type === 'value') return `Value voucher · ${formatAmount(card.original_value_cents / 100)}`;
  const visits = card.original_visits ?? 1;
  return `${card.service_pass_name ?? 'Treatment'}${visits > 1 ? ` · ${visits} visits` : ''}`;
}

export default function OrderCard({ order, isBusy, onMarkPaid, onCancel, onToggleBonus, onDownload }: OrderCardProps) {
  const { formatAmount } = useCurrency();
  const [isExpanded, setIsExpanded] = useState(order.status === 'pending_payment');
  const status = STATUS_STYLE[order.status];
  const isPaid = order.status === 'paid';

  return (
    <article className={`${ADMIN_SURFACE} p-5`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" className="min-w-0 text-left" onClick={() => setIsExpanded((value) => !value)} aria-expanded={isExpanded}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-semibold tracking-[0.18em] text-[#1A1714]">{order.order_number}</span>
            <span className={`${ADMIN_STATUS_PILL} ${status.className}`}>{status.label}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-stone-800">{order.title} · {formatAmount(order.total_cents / 100)}</p>
          <p className="text-xs text-stone-500">
            {order.buyer_name} · ordered {new Date(order.created_at).toLocaleString()}
          </p>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'pending_payment' && (
            <>
              <button type="button" className={ADMIN_PRIMARY_BUTTON} disabled={isBusy} onClick={onMarkPaid}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Paid – activate vouchers
              </button>
              <button type="button" className={`${ADMIN_TERTIARY_BUTTON} hover:text-red-600`} disabled={isBusy} onClick={onCancel}>
                <XCircle className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
          {isPaid && (
            <button type="button" className={ADMIN_SECONDARY_BUTTON} disabled={isBusy} onClick={onDownload}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Print vouchers (PDF)
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
              {order.bonus_handed_at ? `Handed over ${new Date(order.bonus_handed_at).toLocaleDateString()}` : 'Tick when handed over'}
            </span>
          </span>
        </label>
      )}

      {isExpanded && (
        <div className="mt-4 grid gap-4 border-t border-stone-200/70 pt-4 text-sm md:grid-cols-2">
          <div className="space-y-1.5 text-stone-600">
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-stone-400" /> {order.buyer_email}</p>
            {order.buyer_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-stone-400" /> {order.buyer_phone}</p>}
            {order.recipient_email && <p className="text-xs text-stone-500">For: {order.recipient_email}</p>}
            {order.message && <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs italic text-stone-500">“{order.message}”</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              {order.gift_cards.length} {order.gift_cards.length === 1 ? 'voucher' : 'vouchers'}
            </p>
            <ul className="space-y-1.5">
              {order.gift_cards.map((card) => (
                <li key={card.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2">
                  <span className="truncate text-stone-700">{voucherLine(card, formatAmount)}</span>
                  <span className="shrink-0 font-mono text-xs text-stone-500">{isPaid ? card.code : '•••• after payment'}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
