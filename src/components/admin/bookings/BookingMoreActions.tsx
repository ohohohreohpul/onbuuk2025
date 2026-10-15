import { Banknote, CalendarClock, Receipt, RotateCcw, Trash2 } from 'lucide-react';
import type { BookingState } from './bookingState';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';

const TEXT: Translations<{
  addFee: string; resolveFee: string; move: string; invoice: string; reopen: string; deletePermanently: string;
}> = {
  en: { addFee: 'Add no-show fee', resolveFee: 'Resolve fee', move: 'Move appointment', invoice: 'Invoice (PDF)', reopen: 'Reopen as confirmed', deletePermanently: 'Delete permanently' },
  de: { addFee: 'No-Show-Gebühr anlegen', resolveFee: 'Gebühr klären', move: 'Termin verschieben', invoice: 'Rechnung (PDF)', reopen: 'Als bestätigt wiederherstellen', deletePermanently: 'Endgültig löschen' },
  th: { addFee: 'เพิ่มค่าธรรมเนียมไม่มาตามนัด', resolveFee: 'จัดการค่าธรรมเนียม', move: 'เลื่อนนัด', invoice: 'ใบแจ้งหนี้ (PDF)', reopen: 'เปิดใหม่เป็นยืนยันแล้ว', deletePermanently: 'ลบถาวร' },
};

interface BookingMoreActionsProps {
  state: BookingState;
  isBusy: boolean;
  onResolveFee: () => void;
  onAddFee: () => void;
  onRestore: () => void;
  onMove: () => void;
  onInvoice: () => void;
  onDelete: () => void;
}

/** The rarer booking actions, as plain buttons at the bottom of the booking popup. */
export default function BookingMoreActions(props: BookingMoreActionsProps) {
  const { state, isBusy } = props;
  const { t } = useAdminText(TEXT);
  const isClosed = state.stage === 'cancelled' || state.stage === 'completed' || state.stage === 'no-show';

  return (
    <>
      {state.primary === 'add-fee' && (
        <button type="button" onClick={props.onAddFee} disabled={isBusy} className={ADMIN_SECONDARY_BUTTON}><Banknote className="h-4 w-4" /> {t.addFee}</button>
      )}
      {state.primary === 'resolve-fee' && (
        <button type="button" onClick={props.onResolveFee} disabled={isBusy} className={ADMIN_SECONDARY_BUTTON}><Banknote className="h-4 w-4" /> {t.resolveFee}</button>
      )}
      {!isClosed && (
        <button type="button" onClick={props.onMove} disabled={isBusy} className={ADMIN_SECONDARY_BUTTON}><CalendarClock className="h-4 w-4" /> {t.move}</button>
      )}
      {state.stage !== 'cancelled' && (
        <button type="button" onClick={props.onInvoice} disabled={isBusy} className={ADMIN_SECONDARY_BUTTON}><Receipt className="h-4 w-4" /> {t.invoice}</button>
      )}
      {state.stage === 'cancelled' && (
        <button type="button" onClick={props.onRestore} disabled={isBusy} className={ADMIN_SECONDARY_BUTTON}><RotateCcw className="h-4 w-4" /> {t.reopen}</button>
      )}
      <button type="button" onClick={props.onDelete} disabled={isBusy} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50`}><Trash2 className="h-4 w-4" /> {t.deletePermanently}</button>
    </>
  );
}
