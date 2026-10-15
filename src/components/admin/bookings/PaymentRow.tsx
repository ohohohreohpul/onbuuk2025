import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { adminAuth } from '../../../lib/adminAuth';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SELECT, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { BookingPayment, PAYMENT_METHOD_LABELS, isCounterPayment } from './paymentMethods';

type EditableMethod = 'cash' | 'card' | 'gift_card' | 'other';
const EDITABLE_METHODS: EditableMethod[] = ['cash', 'card', 'gift_card', 'other'];
const EDITOR_ROLES = new Set(['owner', 'admin', 'super_admin']);

const TEXT: Translations<{
  edit: string; save: string; saving: string; remove: string; cancel: string; method: string; amount: string;
  confirmRemove: string; failed: string; auditNote: string;
}> = {
  en: {
    edit: 'Correct payment', save: 'Save', saving: 'Saving…', remove: 'Remove', cancel: 'Cancel', method: 'Method',
    amount: 'Amount', confirmRemove: 'Remove this payment? It stays in the history as corrected.',
    failed: 'Could not correct the payment: {reason}', auditNote: 'The original entry is kept as corrected (GoBD).',
  },
  de: {
    edit: 'Zahlung korrigieren', save: 'Speichern', saving: 'Wird gespeichert…', remove: 'Entfernen', cancel: 'Abbrechen',
    method: 'Zahlart', amount: 'Betrag', confirmRemove: 'Diese Zahlung entfernen? Sie bleibt als korrigiert im Verlauf.',
    failed: 'Zahlung konnte nicht korrigiert werden: {reason}', auditNote: 'Der ursprüngliche Eintrag bleibt als korrigiert erhalten (GoBD).',
  },
  th: {
    edit: 'แก้ไขการชำระเงิน', save: 'บันทึก', saving: 'กำลังบันทึก…', remove: 'ลบ', cancel: 'ยกเลิก', method: 'วิธีชำระ',
    amount: 'จำนวนเงิน', confirmRemove: 'ลบรายการชำระเงินนี้? รายการจะยังอยู่ในประวัติว่าแก้ไขแล้ว',
    failed: 'แก้ไขการชำระเงินไม่สำเร็จ: {reason}', auditNote: 'รายการเดิมจะถูกเก็บไว้ว่าแก้ไขแล้ว (ตามกฎ GoBD)',
  },
};

interface PaymentRowProps {
  payment: BookingPayment;
  onCorrected: () => void;
}

const canCorrect = (): boolean => EDITOR_ROLES.has(adminAuth.getCurrentUser()?.role ?? '');

/** One recorded payment; owners and admins can correct counter payments. */
export default function PaymentRow({ payment, onCorrected }: PaymentRowProps) {
  const { t, lang } = useAdminText(TEXT);
  const labels = PAYMENT_METHOD_LABELS[lang];
  const { formatPrice } = useCurrency();
  const [isEditing, setIsEditing] = useState(false);
  const [method, setMethod] = useState<EditableMethod>(
    EDITABLE_METHODS.includes(payment.method as EditableMethod) ? payment.method as EditableMethod : 'cash',
  );
  const [amount, setAmount] = useState((payment.amount_cents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditable = isCounterPayment(payment) && canCorrect();

  const submit = async (amountCents: number) => {
    setSaving(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('correct_shop_payment', {
      p_payment_id: payment.id,
      p_method: method,
      p_amount_cents: amountCents,
      p_reference: payment.reference,
    });
    setSaving(false);
    if (rpcError) {
      console.error('Could not correct payment:', rpcError);
      setError(fillText(t.failed, { reason: rpcError.message }));
      return;
    }
    setIsEditing(false);
    onCorrected();
  };

  const handleSave = () => {
    const cents = Math.round(parseFloat(amount.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    submit(cents);
  };

  const handleRemove = () => {
    if (confirm(t.confirmRemove)) submit(0);
  };

  if (isEditing) {
    return (
      <li className="space-y-3 px-4 py-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-500">{t.method}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as EditableMethod)} className={ADMIN_SELECT}>
              {EDITABLE_METHODS.map((option) => <option key={option} value={option}>{labels[option]}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-500">{t.amount}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${ADMIN_INPUT} tabular-nums`} />
          </label>
        </div>
        <p className="text-[11px] text-stone-400">{t.auditNote}</p>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={handleRemove} disabled={saving} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50 hover:text-red-800`}>{t.remove}</button>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsEditing(false)} disabled={saving} className={ADMIN_TERTIARY_BUTTON}>{t.cancel}</button>
            <button type="button" onClick={handleSave} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>{saving ? t.saving : t.save}</button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-stone-700">
        {labels[payment.method]}
        {payment.reference && <span className="ml-2 font-mono text-xs text-stone-400">{payment.reference}</span>}
      </span>
      <span className="flex items-center gap-1">
        <span className="font-medium tabular-nums text-[#1A1714]">{formatPrice(payment.amount_cents)}</span>
        {isEditable && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-label={t.edit}
            title={t.edit}
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </li>
  );
}
