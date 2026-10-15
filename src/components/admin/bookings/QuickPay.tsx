import { useState } from 'react';
import { Banknote, CreditCard, Gift, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

const UNDO_VISIBLE_MS = 10000;

const TEXT: Translations<{
  choose: string; cash: string; card: string; voucher: string; other: string; code: string; redeem: string; cancel: string;
  open: string; failed: string; voucherFailed: string; paid: string; saved: string; undo: string; undone: string; undoFailed: string;
}> = {
  en: {
    choose: 'Choose…', cash: 'Cash', card: 'Card', voucher: 'Gift card', other: 'Other / split…', code: 'Gift card code', redeem: 'Redeem', cancel: 'Back',
    open: '{amount} still open', failed: 'Could not save. Please try again.', voucherFailed: 'Gift card not accepted: {reason}', paid: 'Paid',
    saved: '{method} · {amount} saved', undo: 'Undo', undone: 'Payment taken back.', undoFailed: 'Could not undo: {reason}',
  },
  de: {
    choose: 'Auswählen…', cash: 'Bar', card: 'Karte', voucher: 'Gutschein', other: 'Anders / geteilt…', code: 'Gutschein-Code', redeem: 'Einlösen', cancel: 'Zurück',
    open: 'Noch offen: {amount}', failed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', voucherFailed: 'Gutschein nicht angenommen: {reason}', paid: 'Bezahlt',
    saved: '{method} · {amount} gespeichert', undo: 'Rückgängig', undone: 'Zahlung zurückgenommen.', undoFailed: 'Rückgängig nicht möglich: {reason}',
  },
  th: {
    choose: 'เลือก…', cash: 'เงินสด', card: 'บัตร', voucher: 'บัตรของขวัญ', other: 'วิธีอื่น / แบ่งจ่าย…', code: 'รหัสบัตรของขวัญ', redeem: 'ใช้บัตร', cancel: 'กลับ',
    open: 'ค้างชำระ {amount}', failed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', voucherFailed: 'ใช้บัตรไม่ได้: {reason}', paid: 'ชำระแล้ว',
    saved: '{method} · {amount} บันทึกแล้ว', undo: 'ย้อนกลับ', undone: 'ยกเลิกการชำระแล้ว', undoFailed: 'ย้อนกลับไม่ได้: {reason}',
  },
};

const BUTTON = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 disabled:opacity-50';
const DARK = `${BUTTON} bg-[#1A1714] text-white hover:bg-[#2E2926]`;
const LIGHT = `${BUTTON} bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50`;
/** Dropdown look shared with the dashboard step row. */
export const STEP_SELECT = 'rounded-lg border border-stone-200 bg-white py-1.5 pl-3 pr-8 text-sm text-stone-800 outline-none transition hover:border-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400';

interface QuickPayProps {
  bookingId: string;
  /** Amount still to pay (after vouchers and earlier payments). */
  openCents: number;
  /** Opens the full payment window (split payments, other methods). */
  onOther: () => void;
  /** Called after every recorded payment so the list refreshes. */
  onPaid: () => void;
  /** Inline use (dashboard step row): no "still open" line, no top margin. */
  compact?: boolean;
  /** Greyed out until earlier steps are done. */
  disabled?: boolean;
  /** A single dropdown instead of buttons (dashboard step row). */
  asSelect?: boolean;
  /** Accessible name of the dropdown. */
  label?: string;
}

/** One tap at the counter: how did the customer pay the open amount? */
export default function QuickPay({ bookingId, openCents, onOther, onPaid, compact = false, disabled = false, asSelect = false, label }: QuickPayProps) {
  const { t } = useAdminText(TEXT);
  const { formatPrice } = useCurrency();
  const [busy, setBusy] = useState(false);
  const [askCode, setAskCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const record = async (method: 'cash' | 'card' | 'other', cents: number): Promise<string | null> => {
    const { data, error: rpcError } = await supabase.rpc('record_shop_payment', { p_booking_id: bookingId, p_method: method, p_amount_cents: cents });
    if (rpcError) throw rpcError;
    return (data?.paymentId as string | null) ?? null;
  };

  /** One tap has no confirmation, so every payment can be taken back for a few minutes. */
  const offerUndo = (paymentId: string, method: 'cash' | 'card') => {
    const shown = toast({
      title: fillText(t.saved, { method: method === 'cash' ? t.cash : t.card, amount: formatPrice(openCents) }),
      duration: UNDO_VISIBLE_MS,
      action: (
        <ToastAction altText={t.undo} onClick={async () => {
          const { error: undoError } = await supabase.rpc('undo_shop_payment', { p_payment_id: paymentId });
          if (undoError) {
            console.error('Undo payment failed:', undoError);
            toast({ title: fillText(t.undoFailed, { reason: undoError.message }), variant: 'destructive' });
            return;
          }
          shown.dismiss();
          toast({ title: t.undone, duration: UNDO_VISIBLE_MS / 2 });
          onPaid();
        }}>{t.undo}</ToastAction>
      ),
    });
  };

  const pay = async (method: 'cash' | 'card') => {
    setBusy(true);
    setError('');
    try {
      const paymentId = await record(method, openCents);
      onPaid();
      if (paymentId) offerUndo(paymentId, method);
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
      <div className={`${compact ? '' : 'mt-2 '}flex flex-wrap items-center gap-1.5`}>
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

  if (asSelect) {
    const choose = (value: string) => {
      if (value === 'cash' || value === 'card') void pay(value);
      else if (value === 'voucher') setAskCode(true);
      else if (value === 'other') onOther();
    };
    return (
      <span className="inline-flex items-center gap-2">
        <select value="" onChange={(e) => choose(e.target.value)} disabled={busy || disabled} aria-label={label} className={STEP_SELECT}>
          <option value="">{t.choose}</option>
          <option value="cash">{t.cash}</option>
          <option value="card">{t.card}</option>
          <option value="voucher">{t.voucher}</option>
          <option value="other">{t.other}</option>
        </select>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
        {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
      </span>
    );
  }

  return (
    <div className={compact ? '' : 'mt-2'}>
      {!compact && <p className="mb-1.5 text-[11px] font-medium text-amber-700">{fillText(t.open, { amount: formatPrice(openCents) })}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => pay('cash')} disabled={busy || disabled} className={DARK}><Banknote className="h-4 w-4" /> {t.cash}</button>
        <button type="button" onClick={() => pay('card')} disabled={busy || disabled} className={DARK}><CreditCard className="h-4 w-4" /> {t.card}</button>
        <button type="button" onClick={() => setAskCode(true)} disabled={busy || disabled} className={LIGHT}><Gift className="h-4 w-4" /> {t.voucher}</button>
        {!compact && <button type="button" onClick={onOther} disabled={busy || disabled} className="px-1.5 text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline">{t.other}</button>}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
