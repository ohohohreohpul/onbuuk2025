import { useState } from 'react';
import { Banknote, CreditCard, Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  cash: string; card: string; voucher: string; other: string; code: string; redeem: string; cancel: string;
  open: string; failed: string; voucherFailed: string; paid: string;
}> = {
  en: {
    cash: 'Cash', card: 'Card', voucher: 'Gift card', other: 'Other / split…', code: 'Gift card code', redeem: 'Redeem', cancel: 'Back',
    open: '{amount} still open', failed: 'Could not save. Please try again.', voucherFailed: 'Gift card not accepted: {reason}', paid: 'Paid',
  },
  de: {
    cash: 'Bar', card: 'Karte', voucher: 'Gutschein', other: 'Anders / geteilt…', code: 'Gutschein-Code', redeem: 'Einlösen', cancel: 'Zurück',
    open: 'Noch offen: {amount}', failed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', voucherFailed: 'Gutschein nicht angenommen: {reason}', paid: 'Bezahlt',
  },
  th: {
    cash: 'เงินสด', card: 'บัตร', voucher: 'บัตรของขวัญ', other: 'วิธีอื่น / แบ่งจ่าย…', code: 'รหัสบัตรของขวัญ', redeem: 'ใช้บัตร', cancel: 'กลับ',
    open: 'ค้างชำระ {amount}', failed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', voucherFailed: 'ใช้บัตรไม่ได้: {reason}', paid: 'ชำระแล้ว',
  },
};

const BUTTON = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 disabled:opacity-50';
const DARK = `${BUTTON} bg-[#1A1714] text-white hover:bg-[#2E2926]`;
const LIGHT = `${BUTTON} bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50`;

interface QuickPayProps {
  bookingId: string;
  /** Amount still to pay (after vouchers and earlier payments). */
  openCents: number;
  /** Opens the full payment window (split payments, other methods). */
  onOther: () => void;
  /** Called after every recorded payment so the list refreshes. */
  onPaid: () => void;
}

/** One tap at the counter: how did the customer pay the open amount? */
export default function QuickPay({ bookingId, openCents, onOther, onPaid }: QuickPayProps) {
  const { t } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const [busy, setBusy] = useState(false);
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const record = async (method: 'cash' | 'card' | 'other', cents: number) => {
    const { error: rpcError } = await supabase.rpc('record_shop_payment', { p_booking_id: bookingId, p_method: method, p_amount_cents: cents });
    if (rpcError) throw rpcError;
  };

  const pay = async (method: 'cash' | 'card') => {
    setBusy(true);
    setError('');
    try {
      await record(method, openCents);
      onPaid();
    } catch (payError) {
      console.error('Quick payment failed:', payError);
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    const { data, error: redeemError } = await supabase.rpc('redeem_gift_card_for_booking', {
      p_booking_id: bookingId, p_code: code.trim(), p_requested_amount_cents: openCents,
    });
    if (redeemError) {
      setError(fillText(t.voucherFailed, { reason: redeemError.message }));
      setBusy(false);
      return;
    }
    try {
      // Closes the booking when the gift card covered everything; otherwise the rest stays open.
      if (Number(data?.bookingFinalAmountCents ?? 0) === 0) await record('other', 0);
      setAskCode(false);
      setCode('');
      onPaid();
    } catch (closeError) {
      console.error('Could not close booking after gift card:', closeError);
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  if (askCode) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && redeem()}
          placeholder={t.code} aria-label={t.code} autoFocus
          className="w-44 rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm uppercase outline-none focus:border-stone-400" />
        <button type="button" onClick={redeem} disabled={busy || !code.trim()} className={DARK}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} {t.redeem}
        </button>
        <button type="button" onClick={() => { setAskCode(false); setError(''); }} className="px-2 text-sm text-stone-500 hover:text-stone-800">{t.cancel}</button>
        {error && <p role="alert" className="w-full text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-[11px] font-medium text-amber-700">{fillText(t.open, { amount: formatPrice(openCents) })}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => pay('cash')} disabled={busy} className={DARK}><Banknote className="h-4 w-4" /> {t.cash}</button>
        <button type="button" onClick={() => pay('card')} disabled={busy} className={DARK}><CreditCard className="h-4 w-4" /> {t.card}</button>
        <button type="button" onClick={() => setAskCode(true)} disabled={busy} className={LIGHT}><Gift className="h-4 w-4" /> {t.voucher}</button>
        <button type="button" onClick={onOther} disabled={busy} className="px-1.5 text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline">{t.other}</button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
