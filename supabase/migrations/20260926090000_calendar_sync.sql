/*
  Calendar sync v1 (iCal), no third-party app approval needed.

  IN:  a specialist adds calendar links (Google/Outlook/Apple/Treatwell iCal URLs).
       The sync-external-calendars function reads them every 10 minutes and stores
       only busy time spans (no titles, attendees or notes). Those spans block the
       booking page and the double-booking guard.
  OUT: each specialist gets a private subscription link (calendar-feed function)
       listing their Zenno bookings: treatment + customer first name only.

  provider = 'ics' today; 'google' is reserved for the live OAuth connection.
*/

-- 1. Calendars to read -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'ics' CHECK (provider IN ('ics', 'google')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  ics_url text CHECK (ics_url IS NULL OR (ics_url ~* '^(https|webcal)://' AND length(ics_url) <= 2048)),
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_error text,
  busy_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (provider <> 'ics' OR ics_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS external_calendars_business_idx ON public.external_calendars (business_id);
CREATE INDEX IF NOT EXISTS external_calendars_active_idx ON public.external_calendars (is_active, last_synced_at);

-- 2. Busy spans (only times) --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_busy_times (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  calendar_id uuid NOT NULL REFERENCES public.external_calendars(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS external_busy_times_lookup_idx
  ON public.external_busy_times (specialist_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS external_busy_times_calendar_idx ON public.external_busy_times (calendar_id);

-- 3. Outgoing subscription links ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL UNIQUE REFERENCES public.specialists(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_fetched_at timestamptz
);

-- 4. Access: admins of the business only (URLs and tokens are secrets) -------------
ALTER TABLE public.external_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_busy_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own external calendars" ON public.external_calendars;
CREATE POLICY "Admins manage own external calendars" ON public.external_calendars
  FOR ALL TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (
    business_id = public.get_admin_business_id()
    AND EXISTS (SELECT 1 FROM public.specialists s WHERE s.id = external_calendars.specialist_id AND s.business_id = external_calendars.business_id)
  );

DROP POLICY IF EXISTS "Admins read own busy times" ON public.external_busy_times;
CREATE POLICY "Admins read own busy times" ON public.external_busy_times
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());

DROP POLICY IF EXISTS "Admins manage own calendar feeds" ON public.calendar_feeds;
CREATE POLICY "Admins manage own calendar feeds" ON public.calendar_feeds
  FOR ALL TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (
    business_id = public.get_admin_business_id()
    AND EXISTS (SELECT 1 FROM public.specialists s WHERE s.id = calendar_feeds.specialist_id AND s.business_id = calendar_feeds.business_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_calendars TO authenticated;
GRANT SELECT ON public.external_busy_times TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feeds TO authenticated;

-- 5. Sync writes (service role only) ------------------------------------------------
-- Replaces a calendar's busy spans in one statement.
--   p_spans: [{"start": "...Z", "end": "...Z"}] or all-day [{"date": "2026-10-03", "days": 1}]
-- All-day dates are placed in the business's timezone.
CREATE OR REPLACE FUNCTION public.replace_external_busy_times(p_calendar_id uuid, p_spans jsonb, p_error text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_cal public.external_calendars%ROWTYPE;
  v_tz text;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_cal FROM public.external_calendars WHERE id = p_calendar_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF p_error IS NOT NULL THEN
    UPDATE public.external_calendars
    SET last_error = left(p_error, 300), updated_at = now()
    WHERE id = p_calendar_id;
    RETURN 0;
  END IF;

  v_tz := private.business_timezone(v_cal.business_id);

  DELETE FROM public.external_busy_times WHERE calendar_id = p_calendar_id;

  INSERT INTO public.external_busy_times (calendar_id, business_id, specialist_id, starts_at, ends_at)
  SELECT p_calendar_id, v_cal.business_id, v_cal.specialist_id, s.starts_at, s.ends_at
  FROM (
    SELECT
      CASE WHEN e ? 'date'
        THEN ((e->>'date')::date::timestamp AT TIME ZONE v_tz)
        ELSE (e->>'start')::timestamptz END AS starts_at,
      CASE WHEN e ? 'date'
        THEN (((e->>'date')::date + GREATEST(COALESCE((e->>'days')::int, 1), 1))::timestamp AT TIME ZONE v_tz)
        ELSE (e->>'end')::timestamptz END AS ends_at
    FROM jsonb_array_elements(COALESCE(p_spans, '[]'::jsonb)) e
    LIMIT 5000
  ) s
  WHERE s.ends_at > s.starts_at;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.external_calendars
  SET last_synced_at = now(), last_error = NULL, busy_count = v_count, updated_at = now()
  WHERE id = p_calendar_id;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_external_busy_times(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_external_busy_times(uuid, jsonb, text) TO service_role;

-- 6. Busy check now includes external calendars ------------------------------------
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
  WITH tz AS (
    SELECT private.business_timezone(sp.business_id) AS zone
    FROM public.specialists sp WHERE sp.id = p_specialist_id
  )
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
    SELECT 1 FROM public.time_blocks tb, tz
    WHERE tb.specialist_id = p_specialist_id
      AND tb.start_time < ((p_date + p_end) AT TIME ZONE tz.zone)
      AND ((p_date + p_start) AT TIME ZONE tz.zone) < tb.end_time
  )
  OR EXISTS (
    SELECT 1 FROM public.external_busy_times eb, tz
    WHERE eb.specialist_id = p_specialist_id
      AND eb.starts_at < ((p_date + p_end) AT TIME ZONE tz.zone)
      AND ((p_date + p_start) AT TIME ZONE tz.zone) < eb.ends_at
  );
$$;

REVOKE ALL ON FUNCTION private.specialist_is_busy(uuid, date, time, time, uuid) FROM PUBLIC;

-- 7. Outgoing feed data (read by the calendar-feed function) -----------------------
CREATE OR REPLACE FUNCTION public.calendar_feed_events(p_token text)
RETURNS TABLE (
  booking_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  service_name text,
  customer_first_name text,
  specialist_name text,
  business_name text,
  business_address text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH feed AS (
    UPDATE public.calendar_feeds SET last_fetched_at = now()
    WHERE token = p_token AND length(p_token) >= 32
    RETURNING specialist_id, business_id
  )
  SELECT
    b.id,
    (b.booking_date + b.start_time) AT TIME ZONE private.business_timezone(b.business_id),
    ((b.booking_date + b.start_time) + make_interval(mins => m.duration_minutes)) AT TIME ZONE private.business_timezone(b.business_id),
    s.name,
    split_part(btrim(b.customer_name), ' ', 1),
    sp.name,
    bz.name,
    bz.address
  FROM feed f
  JOIN public.bookings b ON b.specialist_id = f.specialist_id AND b.business_id = f.business_id
  JOIN public.services s ON s.id = b.service_id
  JOIN public.specialists sp ON sp.id = b.specialist_id
  JOIN public.businesses bz ON bz.id = b.business_id
  CROSS JOIN LATERAL private.booking_block_minutes(b.duration_id, b.total_duration_minutes) m
  WHERE b.status <> 'cancelled'
    AND NOT COALESCE(b.no_show, false)
    AND b.booking_date BETWEEN current_date - 30 AND current_date + 180
  ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.calendar_feed_events(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_feed_events(text) TO service_role;

-- 8. Every 10 minutes: refresh all calendar links ----------------------------------
-- The function authenticates this call with a random secret kept in Vault.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $vault$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'calendar_sync_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'calendar_sync_secret',
      'Authenticates the pg_cron call to the sync-external-calendars function');
  END IF;
END
$vault$;

CREATE OR REPLACE FUNCTION public.calendar_sync_secret_matches(p_secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(length(p_secret) >= 32 AND p_secret = (
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_secret' LIMIT 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.calendar_sync_secret_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_sync_secret_matches(text) TO service_role;

SELECT cron.unschedule('sync-external-calendars')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-external-calendars');

SELECT cron.schedule(
  'sync-external-calendars',
  '*/10 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://eicxhwgxelwcmxcjppwt.supabase.co/functions/v1/sync-external-calendars',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-calendar-sync-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_secret' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
