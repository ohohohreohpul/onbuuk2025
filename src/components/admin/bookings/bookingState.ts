import type { Translations } from '../../../lib/bookingLanguage';

export type FeeResolution = 'unpaid' | 'paid' | 'waived';

export interface BookingStateInput {
  status: string;
  no_show: boolean;
  booking_date: string;
  start_time: string;
  hasNoShowFee: boolean;
  feeResolution: FeeResolution | null;
}

export type BookingStage =
  | 'needs-confirmation'
  | 'upcoming'
  | 'awaiting-checkout'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export type PrimaryAction = 'confirm' | 'complete' | 'resolve-fee' | 'add-fee' | null;

export interface BookingState {
  stage: BookingStage;
  label: string;
  hint: string;
  tone: 'amber' | 'green' | 'stone' | 'red' | 'muted';
  primary: PrimaryAction;
  canMarkNoShow: boolean;
  needsAction: boolean;
}

export interface BookingStateText extends Record<string, string> {
  noShow: string; feeNotCollected: string; feePaid: string; feeWaived: string; feeNotBilled: string; noFee: string;
  cancelled: string; slotFree: string; completed: string; allDone: string;
  needsConfirmation: string; customerWaiting: string; didTheyShow: string; timePassed: string;
  confirmed: string; nothingToDo: string;
}

/** Displayed status labels and hints for each admin language. */
export const BOOKING_STATE_TEXT: Translations<BookingStateText> = {
  en: {
    noShow: 'No-show', feeNotCollected: 'Fee not collected yet', feePaid: 'Fee paid', feeWaived: 'Fee waived',
    feeNotBilled: 'Fee not billed yet', noFee: 'No fee for this service',
    cancelled: 'Cancelled', slotFree: 'Slot is free again', completed: 'Completed', allDone: 'All done',
    needsConfirmation: 'Needs confirmation', customerWaiting: 'Customer is waiting for a reply',
    didTheyShow: 'Did they show up?', timePassed: 'Appointment time has passed',
    confirmed: 'Confirmed', nothingToDo: 'Nothing to do yet',
  },
  de: {
    noShow: 'No-Show', feeNotCollected: 'Gebühr noch nicht eingezogen', feePaid: 'Gebühr bezahlt', feeWaived: 'Gebühr erlassen',
    feeNotBilled: 'Gebühr noch nicht berechnet', noFee: 'Keine Gebühr für diese Leistung',
    cancelled: 'Storniert', slotFree: 'Termin ist wieder frei', completed: 'Abgeschlossen', allDone: 'Alles erledigt',
    needsConfirmation: 'Bestätigung nötig', customerWaiting: 'Kunde wartet auf Antwort',
    didTheyShow: 'Erschienen?', timePassed: 'Terminzeit ist vorbei',
    confirmed: 'Bestätigt', nothingToDo: 'Noch nichts zu tun',
  },
  th: {
    noShow: 'ไม่มาตามนัด', feeNotCollected: 'ยังไม่ได้เก็บค่าธรรมเนียม', feePaid: 'ชำระค่าธรรมเนียมแล้ว', feeWaived: 'ยกเว้นค่าธรรมเนียม',
    feeNotBilled: 'ยังไม่ได้เรียกเก็บค่าธรรมเนียม', noFee: 'บริการนี้ไม่มีค่าธรรมเนียม',
    cancelled: 'ยกเลิกแล้ว', slotFree: 'ช่วงเวลานี้ว่างแล้ว', completed: 'เสร็จสิ้น', allDone: 'เรียบร้อยแล้ว',
    needsConfirmation: 'รอยืนยัน', customerWaiting: 'ลูกค้ากำลังรอคำตอบ',
    didTheyShow: 'ลูกค้ามาหรือไม่?', timePassed: 'เลยเวลานัดหมายแล้ว',
    confirmed: 'ยืนยันแล้ว', nothingToDo: 'ยังไม่มีอะไรต้องทำ',
  },
};

const bookingStart = (date: string, time: string): Date => new Date(`${date}T${time || '00:00:00'}`);

const noShowState = (input: BookingStateInput, text: BookingStateText): BookingState => {
  const base = { stage: 'no-show' as const, label: text.noShow, tone: 'red' as const, canMarkNoShow: false };
  if (input.feeResolution === 'unpaid') {
    return { ...base, hint: text.feeNotCollected, primary: 'resolve-fee', needsAction: true };
  }
  if (input.feeResolution === 'paid') {
    return { ...base, hint: text.feePaid, primary: null, needsAction: false };
  }
  if (input.feeResolution === 'waived') {
    return { ...base, hint: text.feeWaived, primary: null, needsAction: false };
  }
  if (input.hasNoShowFee) {
    return { ...base, hint: text.feeNotBilled, primary: 'add-fee', needsAction: true };
  }
  return { ...base, hint: text.noFee, primary: null, needsAction: false };
};

export function deriveBookingState(
  input: BookingStateInput,
  now: Date = new Date(),
  text: BookingStateText = BOOKING_STATE_TEXT.en,
): BookingState {
  if (input.no_show) return noShowState(input, text);

  if (input.status === 'cancelled') {
    return { stage: 'cancelled', label: text.cancelled, hint: text.slotFree, tone: 'muted', primary: null, canMarkNoShow: false, needsAction: false };
  }

  if (input.status === 'completed') {
    return { stage: 'completed', label: text.completed, hint: text.allDone, tone: 'stone', primary: null, canMarkNoShow: false, needsAction: false };
  }

  const hasStarted = bookingStart(input.booking_date, input.start_time) <= now;

  if (input.status === 'pending' && !hasStarted) {
    return { stage: 'needs-confirmation', label: text.needsConfirmation, hint: text.customerWaiting, tone: 'amber', primary: 'confirm', canMarkNoShow: false, needsAction: true };
  }

  if (hasStarted) {
    return { stage: 'awaiting-checkout', label: text.didTheyShow, hint: text.timePassed, tone: 'amber', primary: 'complete', canMarkNoShow: true, needsAction: true };
  }

  return { stage: 'upcoming', label: text.confirmed, hint: text.nothingToDo, tone: 'green', primary: null, canMarkNoShow: false, needsAction: false };
}

export const formatStartTime = (time: string): string => (time ? time.slice(0, 5) : '');
