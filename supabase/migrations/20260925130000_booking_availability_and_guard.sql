/*
  Real availability + double-booking guard.

  Before: the booking page offered 09:00–19:30 every day for 14 days and nothing
  checked existing bookings, working hours or time off, so customers could book
  closed days and two people could book the same specialist at the same time.

  1. private.booking_window(...)     interval a booking occupies (incl. buffers)
  2. private.specialist_is_busy(...) overlapping active booking or time block
  3. private.specialist_works(...)   the slot fits the specialist's working hours
  4. public.get_available_slots(...) free start times for the booking page
  5. trigger guard_booking_slot      rejects overlaps at save time (serialised per
                                     business+day) and assigns a free specialist
                                     when the customer chose "anyone"

  Active booking = status <> 'cancelled' and not a no-show.
  Times are the business's local wall-clock times (bookings.booking_date/start_time);
  time_blocks are timestamptz and are converted with the business timezone.
*/

CREATE SCHEMA IF NOT EXISTS private;

-- Business timezone from settings (defaults to Europe/Berlin).
CREATE OR REPLACE FUNCTION private.business_timezone(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tz text;
BEGIN
  SELECT NULLIF(trim(both '"' from s.value), '') INTO v_tz
  FROM public.site_settings s
  WHERE s.business_id = p_business_id AND s.key = 'timezone'
  LIMIT 1;

  IF v_tz IS NULL THEN
    RETURN 'Europe/Berlin';
  END IF;

  PERFORM now() AT TIME ZONE v_tz;  -- raises for an unknown zone name
  RETURN v_tz;
EXCEPTION WHEN OTHERS THEN
  RETURN 'Europe/Berlin';
END;
$$;

-- Minutes a booking blocks: its duration plus the service's buffers.
CREATE OR REPLACE FUNCTION private.booking_block_minutes(p_duration_id uuid, p_total_minutes integer)
RETURNS TABLE (before_minutes integer, duration_minutes integer, after_minutes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(s.buffer_before, 0),
    COALESCE(p_total_minutes, d.duration_minutes, 60),
    COALESCE(s.buffer_after, 0)
  FROM (SELECT 1) one
  LEFT JOIN public.service_durations d ON d.id = p_duration_id
  LEFT JOIN public.services s ON s.id = d.service_id;
$$;

-- Is the specialist busy between [p_start, p_end) on p_date (local wall-clock)?
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
    WHERE b.specialist_id = p_specialist_id
      AND b.booking_date = p_date
      AND b.status <> 'cancelled'
      AND NOT COALESCE(b.no_show, false)
      AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
      AND (b.start_time - make_interval(mins => m.before_minutes)) < p_end
      AND p_start < (b.start_time + make_interval(mins => m.duration_minutes + m.after_minutes))
  )
  OR EXISTS (
    SELECT 1
    FROM public.time_blocks tb
    JOIN public.specialists sp ON sp.id = tb.specialist_id
    WHERE tb.specialist_id = p_specialist_id
      AND tb.start_time < ((p_date + p_end) AT TIME ZONE private.business_timezone(sp.business_id))
      AND ((p_date + p_start) AT TIME ZONE private.business_timezone(sp.business_id)) < tb.end_time
  );
$$;

-- Does [p_start, p_end) fit into the specialist's working hours that weekday?
CREATE OR REPLACE FUNCTION private.specialist_works(p_specialist_id uuid, p_date date, p_start time, p_end time)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.working_hours wh
    WHERE wh.specialist_id = p_specialist_id
      AND wh.day_of_week = EXTRACT(DOW FROM p_date)::int
      AND COALESCE(wh.is_available, true)
      AND wh.start_time <= p_start
      AND p_end <= wh.end_time
  );
$$;

-- Specialists who may perform a service: those assigned to it, or every active
-- specialist of the business when the service has no assignments.
CREATE OR REPLACE FUNCTION private.service_specialists(p_business_id uuid, p_service_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT sp.id
  FROM public.specialists sp
  WHERE sp.business_id = p_business_id
    AND COALESCE(sp.is_active, true)
    AND (
      NOT EXISTS (SELECT 1 FROM public.specialist_services ss WHERE ss.service_id = p_service_id)
      OR EXISTS (SELECT 1 FROM public.specialist_services ss WHERE ss.service_id = p_service_id AND ss.specialist_id = sp.id)
    );
$$;

REVOKE ALL ON FUNCTION private.business_timezone(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.booking_block_minutes(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.specialist_is_busy(uuid, date, time, time, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.specialist_works(uuid, date, time, time) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.service_specialists(uuid, uuid) FROM PUBLIC;

-- Free start times for the booking page. Returns only times and a count, never
-- other customers' data, so it is safe for anonymous visitors.
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id uuid,
  p_duration_id uuid,
  p_specialist_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_days integer DEFAULT 14,
  p_step_minutes integer DEFAULT 30
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
  v_tz text := private.business_timezone(p_business_id);
  v_now timestamp := now() AT TIME ZONE private.business_timezone(p_business_id);
  v_window integer;
  v_days integer;
  v_step integer := GREATEST(5, LEAST(COALESCE(p_step_minutes, 30), 120));
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
  candidates AS (
    SELECT id FROM private.service_specialists(p_business_id, v_service_id) id
    WHERE p_specialist_id IS NULL OR id = p_specialist_id
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
  -- Bookings without a specialist (made before this guard) still use capacity.
  HAVING count(DISTINCT f.specialist_id) > (
    SELECT count(*) FROM public.bookings b
    CROSS JOIN LATERAL private.booking_block_minutes(b.duration_id, b.total_duration_minutes) m
    WHERE b.business_id = p_business_id AND b.booking_date = f.day AND b.specialist_id IS NULL
      AND b.status <> 'cancelled' AND NOT COALESCE(b.no_show, false)
      AND (b.start_time - make_interval(mins => m.before_minutes)) < (f.start_at + make_interval(mins => v_duration + v_after))
      AND (f.start_at - make_interval(mins => v_before)) < (b.start_time + make_interval(mins => m.duration_minutes + m.after_minutes))
  )
  ORDER BY f.day, f.start_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, integer, integer) TO anon, authenticated;

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
  v_service_id uuid;
  v_pick uuid;
BEGIN
  -- Only active bookings occupy time.
  IF NEW.status = 'cancelled' OR COALESCE(NEW.no_show, false) OR NEW.booking_date IS NULL OR NEW.start_time IS NULL THEN
    RETURN NEW;
  END IF;

  -- On update, only re-check when the slot changes or a cancelled booking is reopened.
  IF TG_OP = 'UPDATE'
     AND NEW.booking_date IS NOT DISTINCT FROM OLD.booking_date
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.specialist_id IS NOT DISTINCT FROM OLD.specialist_id
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

  IF NEW.specialist_id IS NOT NULL THEN
    IF private.specialist_is_busy(NEW.specialist_id, NEW.booking_date, v_start, v_end, NEW.id) THEN
      RAISE EXCEPTION 'SLOT_UNAVAILABLE: this specialist is already booked at that time'
        USING ERRCODE = 'P0001', HINT = 'Choose another time or specialist.';
    END IF;
    RETURN NEW;
  END IF;

  -- "Anyone": assign a free specialist, preferring one scheduled to work then
  -- and with the fewest bookings that day. Businesses without specialists are not blocked.
  SELECT d.service_id INTO v_service_id FROM public.service_durations d WHERE d.id = NEW.duration_id;

  IF NOT EXISTS (SELECT 1 FROM private.service_specialists(NEW.business_id, v_service_id)) THEN
    RETURN NEW;
  END IF;

  SELECT c.id INTO v_pick
  FROM private.service_specialists(NEW.business_id, v_service_id) c(id)
  WHERE NOT private.specialist_is_busy(c.id, NEW.booking_date, v_start, v_end, NEW.id)
  ORDER BY
    private.specialist_works(c.id, NEW.booking_date, NEW.start_time,
      (NEW.start_time + make_interval(mins => v_duration))::time) DESC,
    (SELECT count(*) FROM public.bookings b
      WHERE b.specialist_id = c.id AND b.booking_date = NEW.booking_date AND b.status <> 'cancelled'),
    c.id
  LIMIT 1;

  IF v_pick IS NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: no specialist is free at that time'
      USING ERRCODE = 'P0001', HINT = 'Choose another time.';
  END IF;

  NEW.specialist_id := v_pick;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_booking_slot() FROM PUBLIC;

DROP TRIGGER IF EXISTS guard_booking_slot ON public.bookings;
CREATE TRIGGER guard_booking_slot
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.guard_booking_slot();

-- The specialist lookup and day checks filter on these columns.
CREATE INDEX IF NOT EXISTS idx_bookings_specialist_date_active
  ON public.bookings (specialist_id, booking_date) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_time_blocks_specialist_range
  ON public.time_blocks (specialist_id, start_time, end_time);
