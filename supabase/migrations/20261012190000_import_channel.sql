/*
  Imported bookings (EasyWeek and other systems, Jev order 2026-10-12 item 4).

  bookings.channel = 'import' marks rows created by the admin CSV import. Those
  customers already know their appointment: no confirmation / request /
  shop emails on insert, only the day-before reminder. Later changes (move,
  cancel) notify as usual.
*/

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_channel_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_channel_check CHECK (
  channel IS NULL OR channel IN ('ai_booked', 'ai_referral', 'search', 'social', 'email', 'referral', 'direct', 'admin', 'import'));

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
  v_is_import boolean := TG_OP = 'INSERT' AND COALESCE(NEW.channel = 'import', false);
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

  -- Imported from another system (EasyWeek, ...): the customer already knows the
  -- appointment, so no confirmation or shop email - only the day-before reminder.
  IF v_is_import THEN
    IF NEW.status = 'confirmed' AND COALESCE(v_reminders, true) AND v_starts_at - interval '24 hours' > now() + interval '1 hour' THEN
      PERFORM private.queue_notification(NEW, 'booking_reminder', v_starts_at - interval '24 hours');
    END IF;
    RETURN NEW;
  END IF;

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
