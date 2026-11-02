/*
  # CRM: automatic emails (birthday, special day, win-back) + consent capture

  1. customers.birthday; newsletter_status gains 'pending' (double opt-in sent,
     not yet confirmed) and a consent record (when, where).
  2. bookings.customer_birthday / newsletter_opt_in: filled by the booking form.
     An AFTER INSERT trigger copies them onto the customer and queues the
     double opt-in email (outbox event 'newsletter_confirm').
  3. public.confirm_newsletter(token): the link in that email.
  4. marketing_campaigns.kind:
       monthly      existing behaviour (day of month + hour)
       special_day  one send on send_on at send_hour (Valentinstag, Muttertag, ...)
       birthday     daily check: customers whose birthday is days_before days away
       winback      daily check: last visit winback_days ago, nothing booked since
     The same send queue (marketing_sends), sender and tracking serve all kinds.
     Automations dedupe per customer through run_key (birthday year /
     last-visit date), so nobody gets the same automatic email twice.
*/

-- 1. Customers -------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS newsletter_consent_source text;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_birthday_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_birthday_check
  CHECK (birthday IS NULL OR birthday BETWEEN DATE '1900-01-01' AND DATE '2100-01-01');

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_newsletter_status_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_newsletter_status_check
  CHECK (newsletter_status IS NULL OR newsletter_status IN ('pending', 'subscribed', 'unsubscribed'));

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_newsletter_consent_source_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_newsletter_consent_source_check
  CHECK (newsletter_consent_source IS NULL OR newsletter_consent_source IN ('booking_form', 'admin', 'import'));

-- 2. Booking form fields ------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_birthday date,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_customer_birthday_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_customer_birthday_check
  CHECK (customer_birthday IS NULL OR customer_birthday BETWEEN DATE '1900-01-01' AND DATE '2100-01-01');

ALTER TABLE private.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_event_key_check;
ALTER TABLE private.notification_outbox ADD CONSTRAINT notification_outbox_event_key_check CHECK (event_key IN (
  'booking_received', 'booking_confirmation', 'booking_cancelled', 'booking_reminder', 'booking_rescheduled',
  'owner_new_booking', 'owner_booking_cancelled', 'newsletter_confirm'));

-- Runs after trigger_upsert_customer (triggers fire in name order), so the customer exists.
CREATE OR REPLACE FUNCTION private.capture_marketing_from_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_needs_confirm boolean := false;
BEGIN
  IF NEW.customer_email IS NULL OR (NEW.customer_birthday IS NULL AND NOT NEW.newsletter_opt_in) THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_birthday IS NOT NULL THEN
    UPDATE public.customers
       SET birthday = NEW.customer_birthday
     WHERE business_id = NEW.business_id AND lower(btrim(email)) = lower(btrim(NEW.customer_email));
  END IF;

  IF NEW.newsletter_opt_in THEN
    WITH changed AS (
      UPDATE public.customers
         SET newsletter_status = 'pending', newsletter_changed_at = now(), newsletter_consent_source = 'booking_form'
       WHERE business_id = NEW.business_id AND lower(btrim(email)) = lower(btrim(NEW.customer_email))
         AND newsletter_status IS DISTINCT FROM 'subscribed'
      RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM changed) INTO v_needs_confirm;
    -- The outbox row needs a date and time (snapshot columns are NOT NULL).
    IF v_needs_confirm AND NEW.booking_date IS NOT NULL AND NEW.start_time IS NOT NULL THEN
      PERFORM private.queue_notification(NEW, 'newsletter_confirm');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.capture_marketing_from_booking() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_upsert_customer_marketing ON public.bookings;
CREATE TRIGGER trigger_upsert_customer_marketing
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.capture_marketing_from_booking();

-- 3. Double opt-in confirmation (edge function marketing-unsubscribe?a=confirm) -----
CREATE OR REPLACE FUNCTION public.confirm_newsletter(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_customer record;
BEGIN
  SELECT c.id, c.business_id, c.email, c.newsletter_status, b.name AS shop, b.language
  INTO v_customer
  FROM public.customers c JOIN public.businesses b ON b.id = c.business_id
  WHERE c.unsubscribe_token = p_token;
  IF v_customer.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only a pending request can be confirmed: an old link never re-subscribes someone who left.
  IF v_customer.newsletter_status = 'pending' THEN
    UPDATE public.customers
       SET newsletter_status = 'subscribed', newsletter_changed_at = now()
     WHERE business_id = v_customer.business_id AND lower(btrim(email)) = lower(btrim(v_customer.email))
       AND newsletter_status IS DISTINCT FROM 'unsubscribed';
  END IF;

  RETURN jsonb_build_object(
    'shop', v_customer.shop,
    'language', v_customer.language,
    'confirmed', v_customer.newsletter_status IN ('pending', 'subscribed'));
END;
$function$;

-- Read-only twin for the confirm page (GET shows a button; only the POST confirms).
CREATE OR REPLACE FUNCTION public.newsletter_confirm_preview(p_token uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object('shop', b.name, 'language', b.language,
                            'confirmed', c.newsletter_status IN ('pending', 'subscribed'))
  FROM public.customers c JOIN public.businesses b ON b.id = c.business_id
  WHERE c.unsubscribe_token = p_token;
$function$;

REVOKE ALL ON FUNCTION public.confirm_newsletter(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_newsletter(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.newsletter_confirm_preview(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_confirm_preview(uuid) TO service_role;

-- 4. Campaign kinds ----------------------------------------------------------------
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS send_on date,
  ADD COLUMN IF NOT EXISTS days_before integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winback_days integer NOT NULL DEFAULT 60;

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_kind_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_kind_check
  CHECK (kind IN ('monthly', 'special_day', 'birthday', 'winback'));
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_days_before_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_days_before_check
  CHECK (days_before BETWEEN 0 AND 30);
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_winback_days_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_winback_days_check
  CHECK (winback_days BETWEEN 21 AND 730);
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_send_on_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_send_on_check
  CHECK (kind <> 'special_day' OR send_on IS NOT NULL);

/** Next run of a campaign strictly after p_after, or NULL when it has none left. */
CREATE OR REPLACE FUNCTION private.next_marketing_run(p_campaign public.marketing_campaigns, p_after timestamptz)
 RETURNS timestamptz
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_today date := (p_after AT TIME ZONE 'Europe/Berlin')::date;
  v_candidate timestamptz;
BEGIN
  IF p_campaign.kind = 'monthly' THEN
    RETURN private.next_campaign_run(p_campaign.day_of_month, p_campaign.send_hour, p_after);
  END IF;
  IF p_campaign.kind = 'special_day' THEN
    v_candidate := (p_campaign.send_on + make_interval(hours => p_campaign.send_hour))::timestamp AT TIME ZONE 'Europe/Berlin';
    RETURN CASE WHEN v_candidate > p_after THEN v_candidate END;
  END IF;
  -- birthday / winback: every day at send_hour
  v_candidate := (v_today + make_interval(hours => p_campaign.send_hour))::timestamp AT TIME ZONE 'Europe/Berlin';
  IF v_candidate <= p_after THEN
    v_candidate := (v_today + 1 + make_interval(hours => p_campaign.send_hour))::timestamp AT TIME ZONE 'Europe/Berlin';
  END IF;
  RETURN v_candidate;
END;
$function$;

CREATE OR REPLACE FUNCTION private.marketing_campaign_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  IF NOT NEW.is_active THEN
    NEW.next_send_at := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.next_send_at IS NULL OR NOT OLD.is_active
     OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.send_on IS DISTINCT FROM OLD.send_on
     OR NEW.day_of_month IS DISTINCT FROM OLD.day_of_month OR NEW.send_hour IS DISTINCT FROM OLD.send_hour THEN
    NEW.next_send_at := private.next_marketing_run(NEW, now());
  END IF;
  RETURN NEW;
END;
$function$;

/** Daily automation run: queue the customers due today, one run_key per customer. */
CREATE OR REPLACE FUNCTION private.queue_automation_run(p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_campaign public.marketing_campaigns;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_target date;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_campaign FROM public.marketing_campaigns WHERE id = p_campaign_id;
  IF v_campaign.id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_campaign.kind = 'birthday' THEN
    v_target := v_today + v_campaign.days_before;
    INSERT INTO public.marketing_sends (campaign_id, business_id, customer_id, email, run_key)
    SELECT DISTINCT ON (lower(btrim(c.email))) v_campaign.id, v_campaign.business_id, c.id, btrim(c.email),
           'bday-' || extract(year FROM v_target)::int
    FROM public.customers c
    WHERE c.business_id = v_campaign.business_id
      AND c.birthday IS NOT NULL
      AND c.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      AND c.newsletter_status IS DISTINCT FROM 'unsubscribed'
      AND (v_campaign.audience = 'all' OR c.newsletter_status = 'subscribed')
      AND (
        (extract(month FROM c.birthday) = extract(month FROM v_target) AND extract(day FROM c.birthday) = extract(day FROM v_target))
        -- 29 February birthdays are celebrated on 28 February in other years.
        OR (extract(month FROM c.birthday) = 2 AND extract(day FROM c.birthday) = 29
            AND extract(month FROM v_target) = 2 AND extract(day FROM v_target) = 28
            AND extract(day FROM (date_trunc('year', v_target) + interval '2 months' - interval '1 day')) = 28)
      )
    ORDER BY lower(btrim(c.email)), c.created_at
    ON CONFLICT (campaign_id, customer_id, run_key) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;

  ELSIF v_campaign.kind = 'winback' THEN
    -- A 14-day window catches a missed day without mailing years-old customers on first switch-on.
    INSERT INTO public.marketing_sends (campaign_id, business_id, customer_id, email, run_key)
    SELECT DISTINCT ON (lower(btrim(c.email))) v_campaign.id, v_campaign.business_id, c.id, btrim(c.email),
           'winback-' || s.last_visit_date
    FROM public.customers c
    JOIN public.customer_stats s ON s.customer_id = c.id
    WHERE c.business_id = v_campaign.business_id
      AND c.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      AND c.newsletter_status IS DISTINCT FROM 'unsubscribed'
      AND (v_campaign.audience = 'all' OR c.newsletter_status = 'subscribed')
      AND s.upcoming_count = 0
      AND s.last_visit_date BETWEEN v_today - (v_campaign.winback_days + 14) AND v_today - v_campaign.winback_days
    ORDER BY lower(btrim(c.email)), s.last_visit_date DESC
    ON CONFLICT (campaign_id, customer_id, run_key) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  UPDATE public.marketing_campaigns SET last_queued_at = now() WHERE id = p_campaign_id;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION private.queue_due_campaigns()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_campaign public.marketing_campaigns;
  v_total integer := 0;
BEGIN
  FOR v_campaign IN
    SELECT * FROM public.marketing_campaigns
    WHERE is_active AND next_send_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_campaign.kind IN ('birthday', 'winback') THEN
      v_total := v_total + private.queue_automation_run(v_campaign.id);
    ELSE
      v_total := v_total + private.queue_campaign_run(
        v_campaign.id,
        CASE WHEN v_campaign.kind = 'special_day' THEN 'day-' || v_campaign.send_on
             ELSE to_char(v_campaign.next_send_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM') END);
    END IF;
    UPDATE public.marketing_campaigns
       SET next_send_at = private.next_marketing_run(v_campaign, now())
     WHERE id = v_campaign.id;
  END LOOP;
  RETURN v_total;
END;
$function$;

-- Automations are never "sent now": they pick their own recipients each day.
CREATE OR REPLACE FUNCTION public.send_campaign_now(p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_kind text;
BEGIN
  SELECT kind INTO v_kind FROM public.marketing_campaigns
  WHERE id = p_campaign_id AND business_id = public.get_admin_business_id();
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Campaign not found' USING ERRCODE = '42501';
  END IF;
  IF v_kind IN ('birthday', 'winback') THEN
    RAISE EXCEPTION 'Automatic emails send themselves' USING ERRCODE = '22023';
  END IF;
  RETURN private.queue_campaign_run(p_campaign_id, 'now-' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.marketing_audience_counts()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'subscribers', count(DISTINCT lower(btrim(email))) FILTER (WHERE newsletter_status = 'subscribed'),
    'all', count(DISTINCT lower(btrim(email))) FILTER (WHERE newsletter_status IS DISTINCT FROM 'unsubscribed'),
    'unsubscribed', count(DISTINCT lower(btrim(email))) FILTER (WHERE newsletter_status = 'unsubscribed'),
    'pending', count(DISTINCT lower(btrim(email))) FILTER (WHERE newsletter_status = 'pending'),
    'with_birthday', count(DISTINCT lower(btrim(email))) FILTER (WHERE birthday IS NOT NULL AND newsletter_status IS DISTINCT FROM 'unsubscribed')
  )
  FROM public.customers
  WHERE business_id = public.get_admin_business_id()
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';
$function$;

REVOKE ALL ON FUNCTION private.next_marketing_run(public.marketing_campaigns, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_automation_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_due_campaigns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_campaign_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_campaign_now(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.marketing_audience_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_audience_counts() TO authenticated;
