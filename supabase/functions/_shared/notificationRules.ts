/**
 * Last check before a queued booking email goes out: the booking may have
 * changed since it was queued (confirmed, cancelled, moved).
 */
import type { NotificationEvent } from "./bookingEmailTemplates.ts";

export interface QueuedNotification {
  event: NotificationEvent;
  /** Appointment when the message was queued. */
  bookingDate: string;
  startTime: string; // "HH:MM" or "HH:MM:SS"
}

export interface CurrentBooking {
  status: string;
  bookingDate: string;
  startTime: string;
}

export type SendDecision = { send: true } | { send: false; reason: string };

const REQUIRED_STATUS: Record<NotificationEvent, string[]> = {
  booking_received: ["pending"],
  booking_confirmation: ["confirmed"],
  booking_reminder: ["confirmed"],
  booking_cancelled: ["cancelled"],
  owner_new_booking: ["pending", "confirmed"],
  owner_booking_cancelled: ["cancelled"],
};

const hhmm = (time: string) => time.slice(0, 5);

export function decideSend(queued: QueuedNotification, booking: CurrentBooking | null): SendDecision {
  if (!booking) return { send: false, reason: "booking deleted" };
  if (!REQUIRED_STATUS[queued.event].includes(booking.status)) {
    return { send: false, reason: `booking is ${booking.status}` };
  }
  const isMoved = booking.bookingDate !== queued.bookingDate || hhmm(booking.startTime) !== hhmm(queued.startTime);
  if (queued.event === "booking_reminder" && isMoved) {
    return { send: false, reason: "booking was moved" };
  }
  return { send: true };
}
