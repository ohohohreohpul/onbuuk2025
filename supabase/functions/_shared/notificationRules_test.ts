import { assertEquals } from "jsr:@std/assert@1";
import { decideSend } from "./notificationRules.ts";

const QUEUED = { bookingDate: "2026-10-19", startTime: "10:00:00" };
const booking = (status: string, bookingDate = "2026-10-19", startTime = "10:00") => ({ status, bookingDate, startTime });

Deno.test("sends a confirmation for a confirmed booking", () => {
  assertEquals(decideSend({ ...QUEUED, event: "booking_confirmation" }, booking("confirmed")), { send: true });
});

Deno.test("skips the 'request received' mail once the shop already confirmed", () => {
  assertEquals(decideSend({ ...QUEUED, event: "booking_received" }, booking("confirmed")), { send: false, reason: "booking is confirmed" });
});

Deno.test("skips the reminder of a cancelled booking", () => {
  assertEquals(decideSend({ ...QUEUED, event: "booking_reminder" }, booking("cancelled")), { send: false, reason: "booking is cancelled" });
});

Deno.test("skips the reminder of a moved booking", () => {
  assertEquals(decideSend({ ...QUEUED, event: "booking_reminder" }, booking("confirmed", "2026-10-20")), { send: false, reason: "booking was moved" });
});

Deno.test("skips everything for a deleted booking", () => {
  assertEquals(decideSend({ ...QUEUED, event: "owner_new_booking" }, null), { send: false, reason: "booking deleted" });
});

Deno.test("owner hears about a new booking while it is pending or confirmed", () => {
  assertEquals(decideSend({ ...QUEUED, event: "owner_new_booking" }, booking("pending")), { send: true });
  assertEquals(decideSend({ ...QUEUED, event: "owner_new_booking" }, booking("cancelled")).send, false);
});

Deno.test("sends the 'moved' notice for the current time, skips one for an older time", () => {
  assertEquals(decideSend({ ...QUEUED, event: "booking_rescheduled" }, booking("confirmed")), { send: true });
  assertEquals(decideSend({ ...QUEUED, event: "booking_rescheduled" }, booking("confirmed", "2026-10-21")), { send: false, reason: "booking was moved" });
});
