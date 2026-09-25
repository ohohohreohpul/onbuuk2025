/*
  Treatments can be hidden from the online booking page instead of deleted.
  Hidden treatments keep their bookings and vouchers, and the shop can still
  book them in the admin.
*/
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
