import { CheckCircle2, Gift, Store } from 'lucide-react';
import { useCurrency } from '../../lib/currencyContext';
import { useTenant } from '../../lib/tenantContext';
import { useBookingText, fillText, type Translations } from '../../lib/bookingLanguage';
import type { PlacedOrder } from './giftCardOrders';

const TEXT: Translations<{
  title: string;
  orderNumber: string;
  nextTitle: string;
  stepPay: string;
  stepCodes: string;
  stepBonus: string;
  keepNumber: string;
  done: string;
}> = {
  en: {
    title: 'Thank you for your order!',
    orderNumber: 'Order number',
    nextTitle: 'What happens next',
    stepPay: 'Pay {amount} in the shop at {business}, mentioning your order number.',
    stepCodes: 'You receive your vouchers with their codes right after payment.',
    stepBonus: 'Included: {bonus}. We hand it over when you pick up your vouchers.',
    keepNumber: 'Your vouchers are reserved for you and become valid once paid.',
    done: 'Done',
  },
  de: {
    title: 'Vielen Dank für Ihre Bestellung!',
    orderNumber: 'Bestellnummer',
    nextTitle: 'So geht es weiter',
    stepPay: 'Bezahlen Sie {amount} bei {business} im Laden und nennen Sie Ihre Bestellnummer.',
    stepCodes: 'Direkt nach der Zahlung erhalten Sie Ihre Gutscheine mit den Codes.',
    stepBonus: 'Inklusive: {bonus}. Wir überreichen es Ihnen bei der Abholung.',
    keepNumber: 'Ihre Gutscheine sind für Sie reserviert und werden mit der Zahlung gültig.',
    done: 'Fertig',
  },
};

interface OrderPlacedProps {
  order: PlacedOrder;
  onDone: () => void;
}

export default function OrderPlaced({ order, onDone }: OrderPlacedProps) {
  const { formatAmount } = useCurrency();
  const { businessName } = useTenant();
  const { t } = useBookingText(TEXT);

  return (
    <section aria-labelledby="order-placed-title" className="space-y-6 pb-12">
      <div className="rounded-[26px] border border-white/80 bg-white/[0.75] p-6 text-center shadow-[0_18px_45px_-34px_rgba(28,25,23,0.45)] backdrop-blur-xl">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
        <h1 id="order-placed-title" className="mt-3 text-2xl font-light tracking-tight text-stone-900">{t.title}</h1>
        <p className="mt-1 text-sm text-stone-500">{order.title} · {formatAmount(order.total_cents / 100)}</p>
        <div className="mx-auto mt-5 inline-block rounded-2xl border border-dashed border-stone-300 bg-[#F6F3ED] px-6 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{t.orderNumber}</p>
          <p className="font-mono text-3xl font-semibold tracking-[0.25em] text-stone-900">{order.order_number}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-[22px] border border-white/80 bg-white/[0.68] p-5 backdrop-blur-xl">
        <h2 className="text-sm font-semibold text-stone-800">{t.nextTitle}</h2>
        <ol className="space-y-3 text-sm text-stone-600">
          <li className="flex gap-3">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-[#9C7650]" aria-hidden="true" />
            {fillText(t.stepPay, { amount: formatAmount(order.total_cents / 100), business: businessName || '' })}
          </li>
          <li className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#9C7650]" aria-hidden="true" />
            {t.stepCodes}
          </li>
          {order.bonus_note && (
            <li className="flex gap-3">
              <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[#9C7650]" aria-hidden="true" />
              {fillText(t.stepBonus, { bonus: order.bonus_note })}
            </li>
          )}
        </ol>
        <p className="border-t border-stone-200/70 pt-3 text-xs text-stone-500">{t.keepNumber}</p>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="w-full bg-custom-primary px-8 py-4 text-sm tracking-wide text-white transition-colors hover:bg-custom-primary-hover"
      >
        {t.done}
      </button>
    </section>
  );
}
