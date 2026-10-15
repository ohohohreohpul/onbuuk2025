import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, CreditCard, Loader2, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import { ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { cancelOrder, markOrderPaid, type ShopPaymentMethod } from './giftCardOrdersApi';

const TEXT: Translations<{
  close: string; order: string; codes: string; codesHint: string; recipient: string; notPaid: string; notPaidHint: string;
  paidCash: string; paidCard: string; paidDone: string; cancelOrder: string; cancelConfirm: string; loadFailed: string; actionFailed: string;
}> = {
  en: {
    close: 'Close', order: 'Order {code}', codes: 'Voucher code', codesHint: 'Valid once paid. Hand it to the customer after payment.', recipient: 'For',
    notPaid: 'Not paid yet', notPaidHint: 'How did the customer pay?', paidCash: 'Paid cash', paidCard: 'Paid by card', paidDone: 'Paid – the voucher is active.',
    cancelOrder: 'Cancel order', cancelConfirm: 'Cancel order {code}? Its vouchers can no longer be used.', loadFailed: 'Could not load the order.', actionFailed: 'Could not save. Please try again.',
  },
  de: {
    close: 'Schließen', order: 'Bestellung {code}', codes: 'Gutscheincode', codesHint: 'Gültig nach Zahlung. Nach dem Bezahlen an die Kundin / den Kunden geben.', recipient: 'Für',
    notPaid: 'Noch nicht bezahlt', notPaidHint: 'Wie wurde bezahlt?', paidCash: 'Bar bezahlt', paidCard: 'Mit Karte bezahlt', paidDone: 'Bezahlt – der Gutschein ist gültig.',
    cancelOrder: 'Bestellung stornieren', cancelConfirm: 'Bestellung {code} stornieren? Die Gutscheine sind dann nicht mehr gültig.', loadFailed: 'Bestellung konnte nicht geladen werden.', actionFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
  },
  th: {
    close: 'ปิด', order: 'คำสั่งซื้อ {code}', codes: 'รหัสบัตรของขวัญ', codesHint: 'ใช้ได้หลังชำระเงิน ให้ลูกค้าหลังชำระแล้ว', recipient: 'สำหรับ',
    notPaid: 'ยังไม่ชำระ', notPaidHint: 'ลูกค้าชำระด้วยวิธีใด?', paidCash: 'ชำระเงินสดแล้ว', paidCard: 'ชำระด้วยบัตรแล้ว', paidDone: 'ชำระแล้ว – บัตรใช้ได้แล้ว',
    cancelOrder: 'ยกเลิกคำสั่งซื้อ', cancelConfirm: 'ยกเลิกคำสั่งซื้อ {code}? บัตรจะใช้ไม่ได้อีก', loadFailed: 'โหลดคำสั่งซื้อไม่สำเร็จ', actionFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
};

interface TaskOrder {
  id: string;
  order_number: string;
  title: string;
  total_cents: number;
  status: string;
  buyer_name: string;
  buyer_email: string | null;
  recipient_email: string | null;
  gift_cards: { code: string }[] | null;
}

interface OrderTaskModalProps {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}

/** The order popup: a gift card order paid in the shop – codes, then "Bar bezahlt" / "Mit Karte bezahlt". */
export default function OrderTaskModal({ orderId, onClose, onChanged }: OrderTaskModalProps) {
  const { t } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<TaskOrder | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('gift_card_orders')
      .select('id, order_number, title, total_cents, status, buyer_name, buyer_email, recipient_email, gift_cards(code)')
      .eq('id', orderId)
      .maybeSingle();
    if (loadError || !data) {
      console.error('Could not load order:', loadError);
      setError(t.loadFailed);
      return;
    }
    setOrder(data as TaskOrder);
  }, [orderId, t.loadFailed]);

  useEffect(() => { load(); }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      onChanged();
    } catch (actionError) {
      console.error('Order action failed:', actionError);
      setError(t.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const pay = (method: ShopPaymentMethod) => order && run(() => markOrderPaid(order.id, method));
  const cancel = () => order && confirm(fillText(t.cancelConfirm, { code: order.order_number })) && run(() => cancelOrder(order.id));

  // Portal to <body>: inside dashboard cards the popup would sit under later cards.
  return createPortal(
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="order-task-title">
      <div className={`${ADMIN_MODAL} max-h-[90vh] max-w-lg overflow-y-auto`}>
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          {order ? (
            <div>
              <h2 id="order-task-title" className="text-xl font-semibold text-[#1A1714]">{order.buyer_name}</h2>
              <p className="mt-1 font-mono text-sm tracking-wider text-stone-600">{fillText(t.order, { code: order.order_number })}</p>
              <p className="text-sm text-stone-500">{order.title} · {formatPrice(order.total_cents)}</p>
              {order.recipient_email && <p className="text-sm text-stone-500">{t.recipient}: {order.recipient_email}</p>}
            </div>
          ) : <h2 id="order-task-title" className="sr-only">…</h2>}
          <button type="button" onClick={onClose} aria-label={t.close} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-900/[0.05] hover:text-stone-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 p-6">
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {!order && !error && <Loader2 className="mx-auto h-5 w-5 animate-spin text-stone-400" />}
          {order && (
            <>
              <section className="rounded-2xl bg-[#F7F5F2] p-4">
                <h3 className="text-sm font-semibold text-[#1A1714]">{t.codes}</h3>
                <p className="mt-1 font-mono text-lg tracking-wider text-[#1A1714]">{(order.gift_cards ?? []).map((card) => card.code).join(', ') || '–'}</p>
                {order.status === 'pending_payment' && <p className="mt-1 text-xs text-stone-500">{t.codesHint}</p>}
              </section>

              {order.status === 'pending_payment' ? (
                <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200/70">
                  <h3 className="text-sm font-semibold text-amber-900">{t.notPaid}</h3>
                  <p className="mb-3 mt-0.5 text-sm text-amber-800">{t.notPaidHint}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => pay('cash')} className={ADMIN_PRIMARY_BUTTON}><Banknote className="h-4 w-4" /> {t.paidCash}</button>
                    <button type="button" disabled={busy} onClick={() => pay('card')} className={ADMIN_PRIMARY_BUTTON}><CreditCard className="h-4 w-4" /> {t.paidCard}</button>
                  </div>
                </section>
              ) : order.status === 'paid' ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{t.paidDone}</p>
              ) : null}

              {order.status === 'pending_payment' && (
                <button type="button" disabled={busy} onClick={cancel} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50`}>{t.cancelOrder}</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
