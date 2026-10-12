/*
  Hotfix for 20261012090000: the foreign key bookings.partner_specialist_id ->
  specialists gave PostgREST two bookings->specialists relationships, so every
  existing embed like `specialist:specialists(name)` failed with PGRST201
  (admin bookings list, customer portal, booking emails, agent approvals).

  The column stays; only the FK goes. private.guard_booking_slot only ever
  writes ids from private.service_specialists, and a deleted specialist simply
  stops matching in private.specialist_is_busy.
*/

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_partner_specialist_id_fkey;

NOTIFY pgrst, 'reload schema';
