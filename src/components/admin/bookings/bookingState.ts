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

const bookingStart = (date: string, time: string): Date => new Date(`${date}T${time || '00:00:00'}`);

const noShowState = (input: BookingStateInput): BookingState => {
  const base = { stage: 'no-show' as const, label: 'No-show', tone: 'red' as const, canMarkNoShow: false };
  if (input.feeResolution === 'unpaid') {
    return { ...base, hint: 'Fee not collected yet', primary: 'resolve-fee', needsAction: true };
  }
  if (input.feeResolution === 'paid') {
    return { ...base, hint: 'Fee paid', primary: null, needsAction: false };
  }
  if (input.feeResolution === 'waived') {
    return { ...base, hint: 'Fee waived', primary: null, needsAction: false };
  }
  if (input.hasNoShowFee) {
    return { ...base, hint: 'Fee not billed yet', primary: 'add-fee', needsAction: true };
  }
  return { ...base, hint: 'No fee for this service', primary: null, needsAction: false };
};

export function deriveBookingState(input: BookingStateInput, now: Date = new Date()): BookingState {
  if (input.no_show) return noShowState(input);

  if (input.status === 'cancelled') {
    return { stage: 'cancelled', label: 'Cancelled', hint: 'Slot is free again', tone: 'muted', primary: null, canMarkNoShow: false, needsAction: false };
  }

  if (input.status === 'completed') {
    return { stage: 'completed', label: 'Completed', hint: 'All done', tone: 'stone', primary: null, canMarkNoShow: false, needsAction: false };
  }

  const hasStarted = bookingStart(input.booking_date, input.start_time) <= now;

  if (input.status === 'pending' && !hasStarted) {
    return { stage: 'needs-confirmation', label: 'Needs confirmation', hint: 'Customer is waiting for a reply', tone: 'amber', primary: 'confirm', canMarkNoShow: false, needsAction: true };
  }

  if (hasStarted) {
    return { stage: 'awaiting-checkout', label: 'Did they show up?', hint: 'Appointment time has passed', tone: 'amber', primary: 'complete', canMarkNoShow: true, needsAction: true };
  }

  return { stage: 'upcoming', label: 'Confirmed', hint: 'Nothing to do yet', tone: 'green', primary: null, canMarkNoShow: false, needsAction: false };
}

export const formatStartTime = (time: string): string => (time ? time.slice(0, 5) : '');
