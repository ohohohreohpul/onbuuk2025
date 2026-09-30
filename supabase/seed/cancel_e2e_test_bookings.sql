-- Cancels leftover test bookings on the internal e2e test business only.
UPDATE bookings SET status = 'cancelled', updated_at = now()
WHERE business_id = '00000000-0000-4000-a000-00000000e2e0' AND status <> 'cancelled';
