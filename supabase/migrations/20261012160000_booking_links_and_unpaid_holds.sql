/*
  Booking flow fixes from the 2026-10-12 audit.

  1. Guests can't read bookings (RLS), so the /cancel link in every booking
     email and the page after Stripe checkout showed "booking not found".
     The booking id in the link is the key: get_booking_by_link() returns the
     customer's own booking, cancel_booking_by_link() cancels a future one.
  2. A guest insert could set status 'confirmed' / payment_status 'completed'
     itself and skip manual confirmation or payment. Only the shop's admins and
     the server (webhooks, AI agents) set those; guests always start 'pending'
     and the confirmation mode decides.
  3. Online checkouts that are never paid kept the slot forever. Every 15 min,
     unpaid Stripe holds older than 90 min and PayPal holds older than 6 h are
     cancelled (Stripe checkout links now expire after 31 min).
*/

-- 1. Link access ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booking_by_link(p_booking_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', b.id,
    'business_id', b.business_id,
    'status', b.status,
    'payment_status', b.payment_status,
    'booking_date', b.booking_date,
    'start_time', b.start_time,
    'customer_name', b.customer_name,
    'customer_email', b.customer_email,
    'customer_phone', b.customer_phone,
    'service_id', b.service_id,
    'specialist_id', b.specialist_id,
    'is_pair_booking', b.is_pair_booking,
    'final_amount_cents', b.final_amount_cents,
    'service', jsonb_build_object('name', s.name),
    'duration', jsonb_build_object('duration_minutes', d.duration_minutes)
  )
  FROM public.bookings b
  LEFT JOIN public.services s ON s.id = b.service_id
  LEFT JOIN public.service_durations d ON d.id = b.duration_id
  WHERE b.id = p_booking_id;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking_by_link(p_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_booking public.bookings;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_booking.status = 'cancelled' THEN
    RETURN 'already_cancelled';
  END IF;
  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RETURN 'not_cancellable';
  END IF;
  IF (v_booking.booking_date + v_booking.start_time) AT TIME ZONE private.business_timezone(v_booking.business_id) <= now() THEN
    RETURN 'past';
  END IF;

  UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE id = p_booking_id;
  RETURN 'cancelled';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_booking_by_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking_by_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_link(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_by_link(uuid) TO anon, authenticated;

-- 2. Guests can't confirm or mark paid themselves --------------------------------
CREATE OR REPLACE FUNCTION private.apply_confirmation_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_mode text;
  v_is_trusted boolean := COALESCE(auth.role(), '') = 'service_role' OR private.is_business_admin(NEW.business_id);
BEGIN
  -- An older booking page sends status 'pending' again after saving; keep the
  -- automatic confirmation unless an admin changes it on purpose.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'confirmed' AND NEW.status = 'pending'
       AND NEW.payment_method = 'in_person' AND NOT v_is_trusted THEN
      NEW.status := 'confirmed';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_is_trusted THEN
    NEW.status := 'pending';
    NEW.payment_status := 'pending';
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

-- 3. Release unpaid online-payment holds -----------------------------------------
CREATE OR REPLACE FUNCTION private.release_unpaid_booking_holds()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH released AS (
    UPDATE public.bookings b
    SET status = 'cancelled', updated_at = now()
    WHERE b.status = 'pending'
      AND b.payment_status = 'pending'
      AND (
        (b.payment_method = 'stripe' AND b.created_at < now() - interval '90 minutes')
        OR (b.payment_method = 'paypal' AND b.created_at < now() - interval '6 hours')
      )
    RETURNING 1
  )
  SELECT count(*)::int FROM released;
$$;

REVOKE ALL ON FUNCTION private.release_unpaid_booking_holds() FROM PUBLIC;

SELECT cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'release-unpaid-booking-holds';
SELECT cron.schedule('release-unpaid-booking-holds', '*/15 * * * *', $job$ SELECT private.release_unpaid_booking_holds(); $job$);
