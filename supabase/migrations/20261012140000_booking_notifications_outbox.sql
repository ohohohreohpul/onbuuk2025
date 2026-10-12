/*
  Automatic confirmation + booking emails for customer and owner + reminders.

  One place decides what to send: an AFTER trigger on bookings writes rows to
  private.notification_outbox. The edge function process-notifications sends them
  (called every minute by pg_cron, see 20261012141000_notification_cron.sql).
  Every path that creates or changes a booking (booking page, admin, POS, AI
  agents, customer portal, payment webhooks) is covered the same way, and the
  old direct sends from the app are removed so nothing arrives twice.

  Shop settings (businesses):
    booking_confirmation_mode  'auto' (default) | 'manual'
    send_booking_reminders     day-before reminder to the customer
    notify_owner_bookings      emails to the shop on new / cancelled bookings

  bookings.payment_method tells pay-in-shop ('in_person') apart from online
  payment that has not arrived yet ('stripe' / 'paypal'): only the former is
  confirmed automatically on save; online payments confirm in the webhooks.
*/

-- Settings ------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS booking_confirmation_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS send_booking_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_owner_bookings boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_booking_confirmation_mode_check
    CHECK (booking_confirmation_mode IN ('auto', 'manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_method text;

DO $$ BEGIN
  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('in_person', 'stripe', 'paypal', 'none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Automatic confirmation ----------------------------------------------------
CREATE OR REPLACE FUNCTION private.apply_confirmation_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_mode text;
BEGIN
  -- An older booking page sends status 'pending' again after saving; keep the
  -- automatic confirmation unless an admin changes it on purpose.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' AND NEW.status = 'pending'
       AND NEW.payment_method = 'in_person'
       AND NOT private.is_business_admin(NEW.business_id) THEN
      NEW.status := 'confirmed';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending' AND NEW.payment_method IN ('in_person', 'none') THEN
    SELECT b.booking_confirmation_mode INTO v_mode FROM public.businesses b WHERE b.id = NEW.business_id;
    IF COALESCE(v_mode, 'auto') = 'auto' THEN
      NEW.status := 'confirmed';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.apply_confirmation_mode() FROM PUBLIC;

DROP TRIGGER IF EXISTS apply_confirmation_mode ON public.bookings;
CREATE TRIGGER apply_confirmation_mode
  BEFORE INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.apply_confirmation_mode();

-- Outbox --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (event_key IN (
    'booking_received', 'booking_confirmation', 'booking_cancelled', 'booking_reminder',
    'owner_new_booking', 'owner_booking_cancelled')),
  -- Snapshot of the appointment when queued: a reminder for a moved booking is skipped.
  booking_date date NOT NULL,
  start_time time NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  send_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_due
  ON private.notification_outbox (send_after) WHERE status IN ('pending', 'sending');

REVOKE ALL ON private.notification_outbox FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.queue_notification(p_booking public.bookings, p_event text, p_send_after timestamptz DEFAULT now())
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO private.notification_outbox (business_id, booking_id, event_key, booking_date, start_time, send_after)
  VALUES (p_booking.business_id, p_booking.id, p_event, p_booking.booking_date, p_booking.start_time, p_send_after)
  ON CONFLICT (booking_id, event_key) DO NOTHING;
$$;

REVOKE ALL ON FUNCTION private.queue_notification(public.bookings, text, timestamptz) FROM PUBLIC;

-- What to send when a booking is created or its status changes.
CREATE OR REPLACE FUNCTION private.enqueue_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_is_new boolean := TG_OP = 'INSERT';
  v_old_status text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END;
  v_is_online_unpaid boolean := NEW.payment_method IN ('stripe', 'paypal');
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
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.enqueue_booking_notifications();

-- Worker API (service role only) --------------------------------------------
-- Claims due messages; ones stuck in 'sending' for 10 minutes are retried.
CREATE OR REPLACE FUNCTION public.claim_notifications(p_limit integer DEFAULT 25)
RETURNS TABLE (id uuid, business_id uuid, booking_id uuid, event_key text, booking_date date, start_time time, attempts integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE private.notification_outbox o
  SET status = 'sending', attempts = o.attempts + 1, locked_at = now()
  WHERE o.id IN (
    SELECT q.id FROM private.notification_outbox q
    WHERE q.send_after <= now()
      AND (q.status = 'pending' OR (q.status = 'sending' AND q.locked_at < now() - interval '10 minutes'))
    ORDER BY q.send_after
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING o.id, o.business_id, o.booking_id, o.event_key, o.booking_date, o.start_time, o.attempts;
$$;

CREATE OR REPLACE FUNCTION public.finish_notification(p_id uuid, p_status text, p_error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_status NOT IN ('sent', 'skipped', 'failed', 'retry') THEN
    RAISE EXCEPTION 'unknown notification status %', p_status;
  END IF;

  UPDATE private.notification_outbox o
  SET status = CASE
        WHEN p_status = 'retry' AND o.attempts >= 3 THEN 'failed'
        WHEN p_status = 'retry' THEN 'pending'
        ELSE p_status END,
      send_after = CASE WHEN p_status = 'retry' THEN now() + make_interval(mins => 5 * o.attempts) ELSE o.send_after END,
      sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE o.sent_at END,
      last_error = left(p_error, 500),
      locked_at = NULL
  WHERE o.id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_notifications(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_notification(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_notification(uuid, text, text) TO service_role;
