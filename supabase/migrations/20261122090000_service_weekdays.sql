/*
  Services offered only on some weekdays (e.g. Deep Bodywork: Thursday–Saturday).
  available_weekdays: 0 = Sunday … 6 = Saturday; NULL = every day.
  get_available_slots offers no times on other days, and the booking guard blocks
  customers from booking them; the shop's team can still book exceptions.
*/
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS available_weekdays smallint[]
  CHECK (available_weekdays IS NULL OR (cardinality(available_weekdays) > 0 AND available_weekdays <@ ARRAY[0,1,2,3,4,5,6]::smallint[]));

CREATE OR REPLACE FUNCTION public.get_available_slots(p_business_id uuid, p_duration_id uuid, p_specialist_id uuid DEFAULT NULL::uuid, p_from date DEFAULT NULL::date, p_days integer DEFAULT 14, p_step_minutes integer DEFAULT 30, p_people integer DEFAULT 1)
 RETURNS TABLE(slot_date date, slot_time time without time zone, free_specialists integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_service_id uuid;
  v_weekdays smallint[];
  v_before integer;
  v_duration integer;
  v_after integer;
  v_now timestamp := now() AT TIME ZONE private.business_timezone(p_business_id);
  v_window integer;
  v_days integer;
  v_step integer := GREATEST(5, LEAST(COALESCE(p_step_minutes, 30), 120));
  v_people integer := LEAST(GREATEST(COALESCE(p_people, 1), 1), 2);
BEGIN
  SELECT d.service_id, s.available_weekdays INTO v_service_id, v_weekdays
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
      -- Services offered only on some weekdays (0 = Sunday … 6 = Saturday).
      AND (v_weekdays IS NULL OR EXTRACT(DOW FROM (COALESCE(p_from, v_now::date) + g)::date)::smallint = ANY (v_weekdays))
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

CREATE OR REPLACE FUNCTION private.guard_booking_slot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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

  -- Customers can only book a service on the weekdays it is offered; the team may make exceptions.
  IF v_must_work AND EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = v_service_id AND s.available_weekdays IS NOT NULL
      AND NOT (EXTRACT(DOW FROM NEW.booking_date)::smallint = ANY (s.available_weekdays))
  ) THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE: this treatment is not offered on that weekday'
      USING ERRCODE = 'P0001', HINT = 'Choose another day.';
  END IF;

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
