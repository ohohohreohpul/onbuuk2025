import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Package, Search, ShoppingBag } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useCurrency } from '../../../lib/currencyContext';
import { downloadGiftCardsPDF, type GiftCardData } from '../../../lib/giftCardPdfGenerator';
import { ADMIN_INPUT, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE, ADMIN_SEGMENTED_CONTROL, ADMIN_SURFACE } from '../adminUi';
import OrderCard from './OrderCard';
import {
  cancelOrder,
  loadOrders,
  loadPackages,
  markOrderPaid,
  setBonusHanded,
  setPackageActive,
  type GiftCardOrder,
  type PackageSummary,
} from './giftCardOrdersApi';

interface GiftCardOrdersPanelProps {
  businessName: string;
  designUrl: string | null;
  termsAndConditions: string | null;
}

type Filter = 'open' | 'paid' | 'all';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: string })?.message;
  return message || 'Something went wrong. Please try again.';
}

export default function GiftCardOrdersPanel({ businessName, designUrl, termsAndConditions }: GiftCardOrdersPanelProps) {
  const { businessId, language } = useTenant();
  const { currency, currencySymbol, formatAmount } = useCurrency();
  const [orders, setOrders] = useState<GiftCardOrder[]>([]);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!businessId) return;
    try {
      const [nextOrders, nextPackages] = await Promise.all([loadOrders(businessId), loadPackages(businessId)]);
      setOrders(nextOrders);
      setPackages(nextPackages);
    } catch (error) {
      console.error('Could not load gift card orders', error);
      setNotice({ kind: 'error', text: 'Orders could not be loaded.' });
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visibleOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders
      .filter((order) => filter === 'all'
        || (filter === 'open' ? order.status === 'pending_payment' : order.status === 'paid'))
      .filter((order) => !needle || [order.order_number, order.buyer_name, order.buyer_email]
        .some((value) => value.toLowerCase().includes(needle)));
  }, [orders, filter, query]);

  const openCount = orders.filter((order) => order.status === 'pending_payment').length;

  const run = async (orderId: string, action: () => Promise<void>, success?: string) => {
    setBusyId(orderId);
    setNotice(null);
    try {
      await action();
      await refresh();
      if (success) setNotice({ kind: 'success', text: success });
    } catch (error) {
      console.error('Gift card order action failed', error);
      setNotice({ kind: 'error', text: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  const toPdfCards = (order: GiftCardOrder): GiftCardData[] =>
    order.gift_cards
      .filter((card) => card.status !== 'cancelled' && card.status !== 'pending_payment')
      .map((card, index, cards) => ({
        code: card.code,
        amount: card.original_value_cents / 100,
        cardType: card.card_type,
        servicePassName: card.service_pass_name,
        visits: card.original_visits,
        durationMinutes: card.service_durations?.duration_minutes ?? null,
        designUrl: order.gift_card_packages?.cover_url || designUrl,
        termsAndConditions,
        businessName,
        expiresAt: card.expires_at,
        currencySymbol,
        currencyCode: currency,
        language: language === 'de' ? 'de' : 'en',
        note: cards.length > 1 ? `${order.title} · ${index + 1}/${cards.length}` : null,
      }));

  const handleDownload = (order: GiftCardOrder) =>
    run(order.id, () => downloadGiftCardsPDF(toPdfCards(order), `Gutscheine-${order.order_number}.pdf`));

  const handleMarkPaid = (order: GiftCardOrder) => {
    if (!window.confirm(`Has ${order.buyer_name} paid ${formatAmount(order.total_cents / 100)}? The vouchers become valid now.`)) return;
    run(order.id, () => markOrderPaid(order.id), `Order ${order.order_number} is paid. Print the vouchers to hand them over.`);
  };

  const handleCancel = (order: GiftCardOrder) => {
    if (!window.confirm(`Cancel order ${order.order_number}? Its vouchers can no longer be used.`)) return;
    run(order.id, () => cancelOrder(order.id), `Order ${order.order_number} was cancelled.`);
  };

  return (
    <div className="space-y-6">
      {packages.length > 0 && (
        <section aria-labelledby="gift-packages-heading" className={`${ADMIN_SURFACE} p-5`}>
          <h2 id="gift-packages-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1A1714]">
            <Package className="h-4 w-4" /> Voucher sets
          </h2>
          <ul className="divide-y divide-stone-200/70">
            {packages.map((pkg) => (
              <li key={pkg.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-stone-800">{pkg.name} · {formatAmount(pkg.price_cents / 100)}</p>
                  <p className="text-xs text-stone-500">
                    {pkg.sold_count} ordered{pkg.stock_limit !== null ? ` of ${pkg.stock_limit}` : ''}
                    {pkg.valid_from || pkg.valid_until
                      ? ` · on sale ${pkg.valid_from ? new Date(pkg.valid_from).toLocaleDateString() : ''}–${pkg.valid_until ? new Date(new Date(pkg.valid_until).getTime() - 1).toLocaleDateString() : ''}`
                      : ''}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#1A1714]"
                    checked={pkg.is_active}
                    disabled={busyId === pkg.id}
                    onChange={(event) => run(pkg.id, () => setPackageActive(pkg.id, event.target.checked))}
                  />
                  On sale
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="gift-orders-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="gift-orders-heading" className="flex items-center gap-2 text-sm font-semibold text-[#1A1714]">
            <ShoppingBag className="h-4 w-4" /> Online orders, paid in the shop
          </h2>
          <div className={ADMIN_SEGMENTED_CONTROL}>
            {([
              ['open', `Awaiting payment${openCount ? ` (${openCount})` : ''}`],
              ['paid', 'Paid'],
              ['all', 'All'],
            ] as [Filter, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === id ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <span className="sr-only">Search orders</span>
          <input
            className={`${ADMIN_INPUT} pl-9`}
            placeholder="Order number, name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {notice && (
          <p role="status" className={`rounded-xl px-4 py-3 text-sm ${notice.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
            {notice.text}
          </p>
        )}

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading orders…</p>
        )}
        {!isLoading && visibleOrders.length === 0 && (
          <p className={`${ADMIN_SURFACE} px-5 py-8 text-center text-sm text-stone-500`}>
            {filter === 'open' ? 'No orders waiting for payment.' : 'No orders yet.'}
          </p>
        )}

        <div className="space-y-3">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isBusy={busyId === order.id}
              onMarkPaid={() => handleMarkPaid(order)}
              onCancel={() => handleCancel(order)}
              onToggleBonus={(isHanded) => run(order.id, () => setBonusHanded(order.id, isHanded))}
              onDownload={() => handleDownload(order)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
