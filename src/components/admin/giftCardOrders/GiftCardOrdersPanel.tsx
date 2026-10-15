import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Package, Search, ShoppingBag } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useCurrency } from '../../../lib/currencyContext';
import { downloadGiftCardsPDF, type GiftCardData } from '../../../lib/giftCardPdfGenerator';
import { ADMIN_INPUT, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE, ADMIN_SEGMENTED_CONTROL, ADMIN_SURFACE } from '../adminUi';
import OrderCard from './OrderCard';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, Translations } from '../../../lib/bookingLanguage';
import {
  cancelOrder,
  loadOrders,
  loadPackages,
  markOrderPaid,
  type ShopPaymentMethod,
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

const TEXT: Translations<{
  genericError: string; loadError: string; confirmPaid: string; paidSuccess: string;
  confirmCancel: string; cancelSuccess: string; voucherSets: string; orderedCount: string; ofStock: string;
  onSaleRange: string; onSale: string; ordersHeading: string; filterOpen: string; filterOpenCount: string;
  filterPaid: string; filterAll: string; searchOrders: string; searchPlaceholder: string; loading: string;
  emptyOpen: string; emptyAll: string;
}> = {
  en: {
    genericError: 'Something went wrong. Please try again.', loadError: 'Orders could not be loaded.',
    confirmPaid: 'Has {name} paid {amount}? The vouchers become valid now.',
    paidSuccess: 'Order {code} is paid. Print the vouchers to hand them over.',
    confirmCancel: 'Cancel order {code}? Its vouchers can no longer be used.', cancelSuccess: 'Order {code} was cancelled.',
    voucherSets: 'Voucher sets', orderedCount: '{count} ordered', ofStock: ' of {count}', onSaleRange: ' · on sale {from}–{until}',
    onSale: 'On sale', ordersHeading: 'Online orders, paid in the shop', filterOpen: 'Awaiting payment',
    filterOpenCount: 'Awaiting payment ({count})', filterPaid: 'Paid', filterAll: 'All', searchOrders: 'Search orders',
    searchPlaceholder: 'Order number, name or email', loading: 'Loading orders…',
    emptyOpen: 'No orders waiting for payment.', emptyAll: 'No orders yet.',
  },
  de: {
    genericError: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.', loadError: 'Bestellungen konnten nicht geladen werden.',
    confirmPaid: 'Hat {name} {amount} bezahlt? Die Gutscheine werden jetzt gültig.',
    paidSuccess: 'Bestellung {code} ist bezahlt. Drucken Sie die Gutscheine für die Übergabe.',
    confirmCancel: 'Bestellung {code} stornieren? Die Gutscheine können dann nicht mehr verwendet werden.',
    cancelSuccess: 'Bestellung {code} wurde storniert.',
    voucherSets: 'Gutschein-Pakete', orderedCount: '{count} bestellt', ofStock: ' von {count}', onSaleRange: ' · im Verkauf {from}–{until}',
    onSale: 'Im Verkauf', ordersHeading: 'Online-Bestellungen mit Zahlung vor Ort', filterOpen: 'Zahlung offen',
    filterOpenCount: 'Zahlung offen ({count})', filterPaid: 'Bezahlt', filterAll: 'Alle', searchOrders: 'Bestellungen suchen',
    searchPlaceholder: 'Bestellnummer, Name oder E-Mail', loading: 'Bestellungen werden geladen…',
    emptyOpen: 'Keine Bestellungen mit offener Zahlung.', emptyAll: 'Noch keine Bestellungen.',
  },
  th: {
    genericError: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง', loadError: 'โหลดคำสั่งซื้อไม่สำเร็จ',
    confirmPaid: '{name} ชำระ {amount} แล้วใช่ไหม? บัตรของขวัญจะใช้งานได้ทันที',
    paidSuccess: 'คำสั่งซื้อ {code} ชำระแล้ว พิมพ์บัตรของขวัญเพื่อส่งมอบได้เลย',
    confirmCancel: 'ยกเลิกคำสั่งซื้อ {code}? บัตรของขวัญในคำสั่งซื้อนี้จะใช้ไม่ได้อีก',
    cancelSuccess: 'ยกเลิกคำสั่งซื้อ {code} แล้ว',
    voucherSets: 'แพ็กเกจบัตรของขวัญ', orderedCount: 'สั่งซื้อแล้ว {count}', ofStock: ' จาก {count}', onSaleRange: ' · วางขาย {from}–{until}',
    onSale: 'วางขาย', ordersHeading: 'คำสั่งซื้อออนไลน์ ชำระที่ร้าน', filterOpen: 'รอชำระเงิน',
    filterOpenCount: 'รอชำระเงิน ({count})', filterPaid: 'ชำระแล้ว', filterAll: 'ทั้งหมด', searchOrders: 'ค้นหาคำสั่งซื้อ',
    searchPlaceholder: 'เลขคำสั่งซื้อ ชื่อ หรืออีเมล', loading: 'กำลังโหลดคำสั่งซื้อ…',
    emptyOpen: 'ไม่มีคำสั่งซื้อที่รอชำระเงิน', emptyAll: 'ยังไม่มีคำสั่งซื้อ',
  },
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: string })?.message;
  return message || fallback;
}

export default function GiftCardOrdersPanel({ businessName, designUrl, termsAndConditions }: GiftCardOrdersPanelProps) {
  const { businessId, language } = useTenant();
  const { currency, currencySymbol, formatAmount } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
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
      setNotice({ kind: 'error', text: t.loadError });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, t]);

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
      setNotice({ kind: 'error', text: errorMessage(error, t.genericError) });
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

  // One tap at the counter: the button names the payment method, so no extra confirmation.
  const handleMarkPaid = (order: GiftCardOrder, method: ShopPaymentMethod) =>
    run(order.id, () => markOrderPaid(order.id, method), fillText(t.paidSuccess, { code: order.order_number }));

  const handleCancel = (order: GiftCardOrder) => {
    if (!window.confirm(fillText(t.confirmCancel, { code: order.order_number }))) return;
    run(order.id, () => cancelOrder(order.id), fillText(t.cancelSuccess, { code: order.order_number }));
  };

  return (
    <div className="space-y-6">
      {packages.length > 0 && (
        <section aria-labelledby="gift-packages-heading" className={`${ADMIN_SURFACE} p-5`}>
          <h2 id="gift-packages-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1A1714]">
            <Package className="h-4 w-4" /> {t.voucherSets}
          </h2>
          <ul className="divide-y divide-stone-200/70">
            {packages.map((pkg) => (
              <li key={pkg.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-stone-800">{pkg.name} · {formatAmount(pkg.price_cents / 100)}</p>
                  <p className="text-xs text-stone-500">
                    {fillText(t.orderedCount, { count: pkg.sold_count })}
                    {pkg.stock_limit !== null ? fillText(t.ofStock, { count: pkg.stock_limit }) : ''}
                    {pkg.valid_from || pkg.valid_until
                      ? fillText(t.onSaleRange, {
                        from: pkg.valid_from ? new Date(pkg.valid_from).toLocaleDateString(locale) : '',
                        until: pkg.valid_until ? new Date(new Date(pkg.valid_until).getTime() - 1).toLocaleDateString(locale) : '',
                      })
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
                  {t.onSale}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="gift-orders-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="gift-orders-heading" className="flex items-center gap-2 text-sm font-semibold text-[#1A1714]">
            <ShoppingBag className="h-4 w-4" /> {t.ordersHeading}
          </h2>
          <div className={ADMIN_SEGMENTED_CONTROL}>
            {([
              ['open', openCount ? fillText(t.filterOpenCount, { count: openCount }) : t.filterOpen],
              ['paid', t.filterPaid],
              ['all', t.filterAll],
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
          <span className="sr-only">{t.searchOrders}</span>
          <input
            className={`${ADMIN_INPUT} pl-9`}
            placeholder={t.searchPlaceholder}
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
          <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> {t.loading}</p>
        )}
        {!isLoading && visibleOrders.length === 0 && (
          <p className={`${ADMIN_SURFACE} px-5 py-8 text-center text-sm text-stone-500`}>
            {filter === 'open' ? t.emptyOpen : t.emptyAll}
          </p>
        )}

        <div className="space-y-3">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isBusy={busyId === order.id}
              onMarkPaid={(method) => handleMarkPaid(order, method)}
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
