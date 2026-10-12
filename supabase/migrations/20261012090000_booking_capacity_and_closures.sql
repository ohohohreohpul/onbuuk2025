/*
  Booking capacity: several therapists, couple bookings, shop closures.

  Builds on 20260925130000_booking_availability_and_guard.sql (live == that file).

  1. Couple bookings (is_pair_booking) occupy TWO therapists. The second one is
     bookings.partner_specialist_id; the guard picks a free one automatically.
     The booking page asks for slots with p_people = 2.
  2. Shop closures: a time_blocks row without specialist closes the whole shop
     (holiday, Betriebsurlaub). It blocks every therapist.
  3. Online and AI bookings must fit the therapist's working hours. "Anyone"
     never lands on a therapist who is off shift. Admins of the business may
     still book outside working hours (but never over another booking).
  4. Schema drift: total_duration_minutes / total_price_cents exist live but in
     no migration; added here with IF NOT EXISTS so a fresh database matches.
*/

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_duration_minutes integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_price_cents integer;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS partner_specialist_id uuid REFERENCES public.specialists(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bookings.partner_specialist_id IS
  'Second therapist of a couple booking (is_pair_booking). Assigned by private.guard_booking_slot.';

CREATE INDEX IF NOT EXISTS idx_bookings_partner_date_active
  ON public.bookings (partner_specialist_id, booking_date)
  WHERE status <> 'cancelled' AND partner_specialist_id IS NOT NULL;

ALTER TABLE public.time_blocks ALTER COLUMN specialist_id DROP NOT NULL;
COMMENT ON COLUMN public.time_blocks.specialist_id IS
  'NULL = the whole shop is closed for this period.';

CREATE INDEX IF NOT EXISTS idx_time_blocks_shop_range
  ON public.time_blocks (business_id, start_time, end_time) WHERE specialist_id IS NULL;

-- Busy = an active booking as main or partner therapist, a personal time block,
-- or a shop closure.
CREATE OR REPLACE FUNCTION private.specialist_is_busy(
  p_specialist_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_exclude_booking uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    CROSS JOIN LATERAL private.booking_block_minutes(b.duration_id, b.total_duration_minutes) m
    WHERE (b.specialist_id = p_specialist_id OR b.partner_specialist_id = p_specialist_id)
      AND b.booking_date = p_date
      AND b.status <> 'cancelled'
      AND NOT COALESCE(b.no_show, false)
      AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
      AND (b.start_time - make_interval(mins => m.before_minutes)) < p_end
      AND p_start < (b.start_time + make_interval(mins => m.duration_minutes + m.after_minutes))
  )
  OR EXISTS (
    SELECT 1
    FROM public.specialists sp
    JOIN public.time_blocks tb
      ON tb.specialist_id = sp.id
      OR (tb.specialist_id IS NULL AND tb.business_id = sp.business_id)
    WHERE sp.id = p_specialist_id
      AND tb.start_time < ((p_date + p_end) AT TIME ZONE private.business_timezone(sp.business_id))
      AND ((p_date + p_start) AT TIME ZONE private.business_timezone(sp.business_id)) < tb.end_time
  );
$$;

-- Is the signed-in user an admin of this business? (false for anon, customers, agents)
CREATE OR REPLACE FUNCTION private.is_business_admin(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.business_id = p_business_id
      AND COALESCE(au.is_active, true)
      AND (au.auth_user_id = auth.uid() OR au.user_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.specialist_is_busy(uuid, date, time, time, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_business_admin(uuid) FROM PUBLIC;

-- Free start times. p_people = 2 for a couple booking: two therapists must be free
-- (with p_specialist_id, that one plus any other). free_specialists = free therapists.
DROP FUNCTION IF EXISTS public.get_available_slots(uuid, uuid, uuid, date, integer, integer);

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id uuid,
  p_duration_id uuid,
  p_specialist_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_days integer DEFAULT 14,
  p_step_minutes integer DEFAULT 30,
  p_people integer DEFAULT 1
)
RETURNS TABLE (slot_date date, slot_time time, free_specialists integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_service_id uuid;
  v_before integer;
  v_duration integer;
  v_after integer;
  v_now timestamp := now() AT TIME ZONE private.business_timezone(p_business_id);
  v_window integer;
  v_days integer;
  v_step integer := GREATEST(5, LEAST(COALESCE(p_step_minutes, 30), 120));
  v_people integer := LEAST(GREATEST(COALESCE(p_people, 1), 1), 2);
BEGIN
  SELECT d.service_id INTO v_service_id
  FROM public.service_durations d
  JOIN public.services s ON s.id = d.service_id
  WHERE d.id = p_duration_id AND s.business_id = p_business_id;

  IF v_service_id IS NULL THEN
    RETURN;  -- unknown duration for this business
  END IF;

  SELECT m.before_minutes, m.duration_minutes, m.after_minutes
    INTO v_before, v_duration, v_after
  FROM private.booking_block_minutes(p_duration_id, NULL) m;

  SELECT NULLIF(regexp_replace(s.value, '\D', '', 'g'), '')::int INTO v_window
  FROM public.site_settings s
  WHERE s.business_id = p_business_id AND s.key = 'bookingWindowDays'
  LIMIT 1;

  v_days := LEAST(GREATEST(COALESCE(p_days, 14), 1), COALESCE(NULLIF(v_window, 0), 60), 120);

  RETURN QUERY
  WITH days AS (
    SELECT (COALESCE(p_from, v_now::date) + g)::date AS day
    FROM generate_series(0, v_days - 1) g
    WHERE (COALESCE(p_from, v_now::date) + g)::date >= v_now::date
  ),
  -- A couple booking with a chosen therapist still needs a second, so look at everyone.
  candidates AS (
    SELECT id FROM private.service_specialists(p_business_id, v_service_id) id
    WHERE p_specialist_id IS NULL OR v_people > 1 OR id = p_specialist_id
  ),
  starts AS (
    SELECT DISTINCT d.day, c.id AS specialist_id,
           (wh.start_time + make_interval(mins => v_before + n * v_step))::time AS start_at
    FROM days d
    JOIN public.working_hours wh
      ON wh.day_of_week = EXTRACT(DOW FROM d.day)::int AND COALESCE(wh.is_available, true)
    JOIN candidates c ON c.id = wh.specialist_id
    CROSS JOIN LATERAL generate_series(
      0,
      GREATEST(-1, ((EXTRACT(EPOCH FROM (wh.end_time - wh.start_time)) / 60)::int - v_before - v_duration) / v_step)
    ) n
  ),
  free AS (
    SELECT s.day, s.start_at, s.specialist_id
    FROM starts s
    WHERE (s.day + s.start_at) > v_now
      AND private.specialist_works(s.specialist_id, s.day, s.start_at, (s.start_at + make_interval(mins => v_duration))::time)
      AND NOT private.specialist_is_busy(
        s.specialist_id, s.day,
        (s.start_at - make_interval(mins => v_before))::time,
        (s.start_at + make_interval(mins => v_duration + v_after))::time
      )
  )
  SELECT f.day, f.start_at, count(DISTINCT f.specialist_id)::int
  FROM free f
  GROUP BY f.day, f.start_at
  HAVING (p_specialist_id IS NULL OR bool_or(f.specialist_id = p_specialist_id))
    -- Bookings without a specialist (made before the guard) still use capacity.
    AND count(DISTINCT f.specialist_id) - (
      SELECT count(*) FROM public.bookings b
      CROSS JOIN LATERAL private.booking_block_minutes(b.duration_id, b.total_duration_minutes) m
      WHERE b.business_id = p_business_id AND b.booking_date = f.day AND b.specialist_id IS NULL
        AND b.status <> 'cancelled' AND NOT COALESCE(b.no_show, false)
        AND (b.start_time - make_interval(mins => m.before_minutes)) < (f.start_at + make_interval(mins => v_duration + v_after))
        AND (f.start_at - make_interval(mins => v_before)) < (b.start_time + make_interval(mins => m.duration_minutes + m.after_minutes))
    ) >= v_people
  ORDER BY f.day, f.start_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, integer, integer, integer) TO anon, authenticated, service_role;

-- Pick a free therapist for [start, end): on shift if required, preferring on-shift
-- and the fewest active bookings that day. NULL when nobody fits.
CREATE OR REPLACE FUNCTION private.pick_free_specialist(
  p_business_id uuid,
  p_service_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_work_start time,
  p_work_end time,
  p_must_work boolean,
  p_exclude_specialist uuid,
  p_exclude_booking uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id
  FROM private.service_specialists(p_business_id, p_service_id) c(id)
  WHERE c.id IS DISTINCT FROM p_exclude_specialist
    AND NOT private.specialist_is_busy(c.id, p_date, p_start, p_end, p_exclude_booking)
    AND (NOT p_must_work OR private.specialist_works(c.id, p_date, p_work_start, p_work_end))
  ORDER BY
    private.specialist_works(c.id, p_date, p_work_start, p_work_end) DESC,
    (SELECT count(*) FROM public.bookings b
      WHERE (b.specialist_id = c.id OR b.partner_specialist_id = c.id)
        AND b.booking_date = p_date AND b.status <> 'cancelled' AND NOT COALESCE(b.no_show, false)),
    c.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.pick_free_specialist(uuid, uuid, date, time, time, time, time, boolean, uuid, uuid) FROM PUBLIC;

-- Save-time guard ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.guard_booking_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_before integer;
  v_duration integer;
  v_after integer;
  v_start time;
  v_end time;
  v_work_end time;
  v_service_id uuid;
  v_must_work boolean;
BEGIN
  -- Only active bookings occupy time. A single booking never keeps a partner.
  IF NOT COALESCE(NEW.is_pair_booking, false) THEN
    NEW.partner_specialist_id := NULL;
  END IF;

  IF NEW.status = 'cancelled' OR COALESCE(NEW.no_show, false) OR NEW.booking_date IS NULL OR NEW.start_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- On update, only re-check when the slot changes or a cancelled booking is reopened.
  IF TG_OP = 'UPDATE'
     AND NEW.booking_date IS NOT DISTINCT FROM OLD.booking_date
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.specialist_id IS NOT DISTINCT FROM OLD.specialist_id
     AND NEW.partner_specialist_id IS NOT DISTINCT FROM OLD.partner_specialist_id
     AND NEW.is_pair_booking IS NOT DISTINCT FROM OLD.is_pair_booking
     AND NEW.duration_id IS NOT DISTINCT FROM OLD.duration_id
     AND NEW.total_duration_minutes IS NOT DISTINCT FROM OLD.total_duration_minutes
     AND NOT (OLD.status = 'cancelled' OR COALESCE(OLD.no_show, false)) THEN
    RETURN NEW;
  END IF;

  -- Serialise concurrent bookings for the same business and day.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.business_id::text || ':' || NEW.booking_date::text, 0));

  SELECT m.before_minutes, m.duration_minutes, m.after_minutes INTO v_before, v_duration, v_after
  FROM private.booking_block_minutes(NEW.duration_id, NEW.total_duration_minutes) m;

  v_start := (NEW.start_time - make_interval(mins => v_before))::time;
  v_end := (NEW.start_time + make_interval(mins => v_duration + v_after))::time;
  v_work_end := (NEW.start_time + make_interval(mins => v_duration))::time;
  v_must_work := NOT private.is_business_admin(NEW.business_id);

  SELECT d.service_id INTO v_service_id FROM public.service_durations d WHERE d.id = NEW.duration_id;

  -- Businesses without therapists are not blocked.
  IF NEW.specialist_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM private.service_specialists(NEW.business_id, v_service_id)) THEN
    RETURN NEW;
  END IF;

  -- Main therapist: check the chosen one, or assign one for "anyone".
  IF NEW.specialist_id IS NOT NULL THEN
    IF private.specialist_is_busy(NEW.specialist_id, NEW.booking_date, v_start, v_end, NEW.id) THEN
      RAISE EXCEPTION 'SLOT_UNAVAILABLE: this specialist is already booked at that time'
        USING ERRCODE = 'P0001', HINT = 'Choose another time or specialist.';
    END IF;
    IF v_must_work AND NOT private.specialist_works(NEW.specialist_id, NEW.booking_date, NEW.start_time, v_work_end) THEN
      RAISE EXCEPTION 'SLOT_UNAVAILABLE: this specialist is not working at that time'
        USING ERRCODE = 'P0001', HINT = 'Choose another time or specialist.';
    END IF;
  ELSE
    NEW.specialist_id := private.pick_free_specialist(
      NEW.business_id, v_service_id, NEW.booking_date, v_start, v_end,
      NEW.start_time, v_work_end, v_must_work, NULL, NEW.id);
    IF NEW.specialist_id IS NULL THEN
      RAISE EXCEPTION 'SLOT_UNAVAILABLE: no specialist is free at that time'
        USING ERRCODE = 'P0001', HINT = 'Choose another time.';
    END IF;
  END IF;

  IF NOT COALESCE(NEW.is_pair_booking, false) THEN
    RETURN NEW;
  END IF;

  -- Couple booking: a second, different therapist for the same time.
  IF NEW.partner_specialist_id IS NOT NULL THEN
    IF NEW.partner_specialist_id = NEW.specialist_id
       OR private.specialist_is_busy(NEW.partner_specialist_id, NEW.booking_date, v_start, v_end, NEW.id)
       OR (v_must_work AND NOT private.specialist_works(NEW.partner_specialist_id, NEW.booking_date, NEW.start_time, v_work_end)) THEN
      RAISE EXCEPTION 'SLOT_UNAVAILABLE: the second therapist is not free at that time'
        USING ERRCODE = 'P0001', HINT = 'Choose another time.';
    END IF;
    RETURN NEW;
  END IF;

  NEW.partner_specialist_id := private.pick_free_specialist(
    NEW.business_id, v_service_id, NEW.booking_date, v_start, v_end,
    NEW.start_time, v_work_end, v_must_work, NEW.specialist_id, NEW.id);
  IF NEW.partner_specialist_id IS NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: only one therapist is free at that time'
      USING ERRCODE = 'P0001', HINT = 'Choose another time for a couple booking.';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_booking_slot() FROM PUBLIC;
-- Trigger guard_booking_slot already points at this function.
