/*
  Moving a booking (Jev order 2026-10-12, item 3).

  The admin bookings list gets "Move appointment" (date/time update; the booking
  guard re-checks the new slot). Emails are now unique per appointment time, not
  per booking: a moved booking gets "booking_rescheduled" for the customer and a
  fresh day-before reminder for the new time; the old reminder is skipped by the
  worker because the booking moved.
*/

ALTER TABLE private.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_booking_id_event_key_key;
ALTER TABLE private.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_once_per_time;
ALTER TABLE private.notification_outbox
  ADD CONSTRAINT notification_outbox_once_per_time UNIQUE (booking_id, event_key, booking_date, start_time);

ALTER TABLE private.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_key_check;
ALTER TABLE private.notification_outbox ADD CONSTRAINT notification_outbox_event_key_check CHECK (event_key IN (
  'booking_received', 'booking_confirmation', 'booking_cancelled', 'booking_reminder', 'booking_rescheduled',
  'owner_new_booking', 'owner_booking_cancelled'));

CREATE OR REPLACE FUNCTION private.queue_notification(p_booking public.bookings, p_event text, p_send_after timestamptz DEFAULT now())
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO private.notification_outbox (business_id, booking_id, event_key, booking_date, start_time, send_after)
  VALUES (p_booking.business_id, p_booking.id, p_event, p_booking.booking_date, p_booking.start_time, p_send_after)
  ON CONFLICT (booking_id, event_key, booking_date, start_time) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION private.queue_notification(public.bookings, text, timestamptz) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.enqueue_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_is_new boolean := TG_OP = 'INSERT';
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END;
  v_is_moved boolean := TG_OP = 'UPDATE'
    AND (NEW.booking_date IS DISTINCT FROM OLD.booking_date OR NEW.start_time IS DISTINCT FROM OLD.start_time);
  v_is_online_unpaid boolean := COALESCE(NEW.payment_method IN ('stripe', 'paypal'), false);  -- NULL payment_method = not online
  v_by_admin boolean := private.is_business_admin(NEW.business_id);
  v_notify_owner boolean;
  v_reminders boolean;
  v_starts_at timestamptz;
BEGIN
  IF NEW.business_id IS NULL OR NEW.booking_date IS NULL OR NEW.start_time IS NULL OR COALESCE(NEW.customer_email, '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT b.notify_owner_bookings, b.send_booking_reminders INTO v_notify_owner, v_reminders
  FROM public.businesses b WHERE b.id = NEW.business_id;

  -- The shop is told about bookings it did not make itself. AI bookings already
  -- notify the shop (with an approve link) in the agent functions.
  v_notify_owner := COALESCE(v_notify_owner, true) AND NOT v_by_admin AND NEW.ai_agent IS NULL;
  v_starts_at := (NEW.booking_date + NEW.start_time) AT TIME ZONE private.business_timezone(NEW.business_id);

  -- Booking request waiting for the shop (manual mode).
  IF NEW.status = 'pending' AND NOT v_is_online_unpaid AND (v_is_new OR v_old_status IS DISTINCT FROM 'pending') THEN
    PERFORM private.queue_notification(NEW, 'booking_received');
    IF v_notify_owner THEN PERFORM private.queue_notification(NEW, 'owner_new_booking'); END IF;
  END IF;

  -- Confirmed: on save (auto mode, admin, paid in full) or later (shop confirms, payment arrives).
  IF NEW.status = 'confirmed' AND (v_is_new OR v_old_status IS DISTINCT FROM 'confirmed') THEN
    -- Walk-ins booked at the counter for right now don't need an email.
    IF NOT (v_by_admin AND v_starts_at < now() + interval '1 hour') THEN
      PERFORM private.queue_notification(NEW, 'booking_confirmation');
    END IF;
    IF v_notify_owner THEN PERFORM private.queue_notification(NEW, 'owner_new_booking'); END IF;
    IF COALESCE(v_reminders, true) AND v_starts_at - interval '24 hours' > now() + interval '1 hour' THEN
      PERFORM private.queue_notification(NEW, 'booking_reminder', v_starts_at - interval '24 hours');
    END IF;
  END IF;

  -- Moved to another time (status unchanged): tell the customer, new reminder.
  IF v_is_moved AND NEW.status = v_old_status AND NEW.status IN ('pending', 'confirmed')
     AND NOT (NEW.status = 'pending' AND v_is_online_unpaid) AND v_starts_at > now() THEN
    PERFORM private.queue_notification(NEW, 'booking_rescheduled');
    IF NEW.status = 'confirmed' AND COALESCE(v_reminders, true) AND v_starts_at - interval '24 hours' > now() + interval '1 hour' THEN
      PERFORM private.queue_notification(NEW, 'booking_reminder', v_starts_at - interval '24 hours');
    END IF;
  END IF;

  -- Cancelled (not no-shows, not abandoned online checkouts).
  IF NOT v_is_new AND NEW.status = 'cancelled' AND v_old_status IN ('pending', 'confirmed')
     AND NOT COALESCE(NEW.no_show, false)
     AND NOT (v_old_status = 'pending' AND v_is_online_unpaid)
     AND v_starts_at > now() THEN
    PERFORM private.queue_notification(NEW, 'booking_cancelled');
    IF COALESCE(v_notify_owner, true) AND NOT v_by_admin THEN
      PERFORM private.queue_notification(NEW, 'owner_booking_cancelled');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enqueue_booking_notifications() FROM PUBLIC;

DROP TRIGGER IF EXISTS enqueue_booking_notifications ON public.bookings;
CREATE TRIGGER enqueue_booking_notifications
  AFTER INSERT OR UPDATE OF status, booking_date, start_time ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.enqueue_booking_notifications();
