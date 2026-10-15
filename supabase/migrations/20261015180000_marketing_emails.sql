/*
  # Promotion emails (monthly, per shop)

  1. customers: newsletter_status ('subscribed' | 'unsubscribed' | NULL = existing
     customer without explicit choice) and a random unsubscribe_token.
  2. marketing_campaigns: subject, text, optional button, audience, and a monthly
     schedule (day of month + hour, Europe/Berlin). next_send_at drives the cron.
  3. marketing_sends: one row per recipient and run; unique per run so a campaign
     never reaches the same customer twice in one month.
  4. Cron every 2 minutes: queue due campaigns, then call send-marketing, which
     sends in batches through the shop's own email provider.
  5. Unsubscribed customers are never queued again.
*/

-- 1. Customers -----------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS newsletter_status text,
  ADD COLUMN IF NOT EXISTS newsletter_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_newsletter_status_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_newsletter_status_check
  CHECK (newsletter_status IS NULL OR newsletter_status IN ('subscribed', 'unsubscribed'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_unsubscribe_token_key ON public.customers (unsubscribe_token);

-- 2. Campaigns -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 10000),
  button_text text CHECK (button_text IS NULL OR length(button_text) <= 60),
  button_url text CHECK (button_url IS NULL OR button_url ~* '^https://'),
  audience text NOT NULL DEFAULT 'subscribers' CHECK (audience IN ('subscribers', 'all')),
  day_of_month integer NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  send_hour integer NOT NULL DEFAULT 10 CHECK (send_hour BETWEEN 6 AND 21),
  is_active boolean NOT NULL DEFAULT false,
  next_send_at timestamptz,
  last_queued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_campaigns_due_idx ON public.marketing_campaigns (next_send_at) WHERE is_active;

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage their shop's campaigns" ON public.marketing_campaigns;
CREATE POLICY "Admins manage their shop's campaigns"
  ON public.marketing_campaigns FOR ALL TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (business_id = public.get_admin_business_id());

REVOKE ALL ON public.marketing_campaigns FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;

/** Next monthly run (day, hour in Europe/Berlin) strictly after p_after. */
CREATE OR REPLACE FUNCTION private.next_campaign_run(p_day integer, p_hour integer, p_after timestamptz)
 RETURNS timestamptz
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_local timestamp := p_after AT TIME ZONE 'Europe/Berlin';
  v_month date := date_trunc('month', v_local)::date;
  v_candidate timestamptz;
BEGIN
  FOR i IN 0..2 LOOP
    v_candidate := (v_month::timestamp + make_interval(months => i, days => p_day - 1, hours => p_hour))
                   AT TIME ZONE 'Europe/Berlin';
    IF v_candidate > p_after THEN
      RETURN v_candidate;
    END IF;
  END LOOP;
  RETURN NULL;
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
     OR NEW.day_of_month IS DISTINCT FROM OLD.day_of_month OR NEW.send_hour IS DISTINCT FROM OLD.send_hour THEN
    NEW.next_send_at := private.next_campaign_run(NEW.day_of_month, NEW.send_hour, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS marketing_campaign_schedule ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaign_schedule
  BEFORE INSERT OR UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION private.marketing_campaign_schedule();

-- 3. Sends ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  run_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, customer_id, run_key)
);

CREATE INDEX IF NOT EXISTS marketing_sends_queue_idx ON public.marketing_sends (created_at) WHERE status IN ('queued', 'sending');
CREATE INDEX IF NOT EXISTS marketing_sends_campaign_idx ON public.marketing_sends (campaign_id, run_key);

ALTER TABLE public.marketing_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read their shop's sends" ON public.marketing_sends;
CREATE POLICY "Admins read their shop's sends"
  ON public.marketing_sends FOR SELECT TO authenticated
  USING (business_id = public.get_admin_business_id());

REVOKE ALL ON public.marketing_sends FROM anon, authenticated;
GRANT SELECT ON public.marketing_sends TO authenticated;

-- Queue one run of a campaign for its audience. Returns the number of recipients.
CREATE OR REPLACE FUNCTION private.queue_campaign_run(p_campaign_id uuid, p_run_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.marketing_sends (campaign_id, business_id, customer_id, email, run_key)
  SELECT DISTINCT ON (lower(btrim(c.email))) m.id, m.business_id, c.id, btrim(c.email), p_run_key
  FROM public.marketing_campaigns m
  JOIN public.customers c ON c.business_id = m.business_id
  WHERE m.id = p_campaign_id
    AND c.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND c.newsletter_status IS DISTINCT FROM 'unsubscribed'
    AND (m.audience = 'all' OR c.newsletter_status = 'subscribed')
  ORDER BY lower(btrim(c.email)), c.created_at
  ON CONFLICT (campaign_id, customer_id, run_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.marketing_campaigns SET last_queued_at = now() WHERE id = p_campaign_id;
  RETURN v_count;
END;
$function$;

-- Cron: queue every campaign that is due and move it to next month.
CREATE OR REPLACE FUNCTION private.queue_due_campaigns()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_campaign record;
  v_total integer := 0;
BEGIN
  FOR v_campaign IN
    SELECT id, day_of_month, send_hour, next_send_at FROM public.marketing_campaigns
    WHERE is_active AND next_send_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    v_total := v_total + private.queue_campaign_run(
      v_campaign.id, to_char(v_campaign.next_send_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM'));
    UPDATE public.marketing_campaigns
       SET next_send_at = private.next_campaign_run(v_campaign.day_of_month, v_campaign.send_hour, now())
     WHERE id = v_campaign.id;
  END LOOP;
  RETURN v_total;
END;
$function$;

-- Admin: send a campaign now (once per day, so a double click cannot send twice).
CREATE OR REPLACE FUNCTION public.send_campaign_now(p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.marketing_campaigns
    WHERE id = p_campaign_id AND business_id = public.get_admin_business_id()
  ) THEN
    RAISE EXCEPTION 'Campaign not found' USING ERRCODE = '42501';
  END IF;
  RETURN private.queue_campaign_run(p_campaign_id, 'now-' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD'));
END;
$function$;

-- Admin: how many customers each audience reaches right now.
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
    'unsubscribed', count(DISTINCT lower(btrim(email))) FILTER (WHERE newsletter_status = 'unsubscribed')
  )
  FROM public.customers
  WHERE business_id = public.get_admin_business_id()
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';
$function$;

-- Sender (service role): claim a batch, report the result.
CREATE OR REPLACE FUNCTION public.claim_marketing_sends(p_limit integer DEFAULT 40)
 RETURNS TABLE (id uuid, campaign_id uuid, business_id uuid, customer_id uuid, email text, attempts integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  UPDATE public.marketing_sends s
  SET status = 'sending', attempts = s.attempts + 1, locked_at = now()
  WHERE s.id IN (
    SELECT q.id FROM public.marketing_sends q
    WHERE q.status = 'queued' OR (q.status = 'sending' AND q.locked_at < now() - interval '10 minutes')
    ORDER BY q.created_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING s.id, s.campaign_id, s.business_id, s.customer_id, s.email, s.attempts;
$function$;

CREATE OR REPLACE FUNCTION public.finish_marketing_send(p_id uuid, p_status text, p_error text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.marketing_sends
  SET status = CASE
        WHEN p_status = 'retry' AND attempts < 3 THEN 'queued'
        WHEN p_status = 'retry' THEN 'failed'
        ELSE p_status
      END,
      last_error = left(p_error, 500),
      sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
      locked_at = NULL
  WHERE id = p_id;
END;
$function$;

-- Public unsubscribe (edge function marketing-unsubscribe, service role).
CREATE OR REPLACE FUNCTION public.marketing_unsubscribe(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_customer record;
BEGIN
  SELECT c.id, c.business_id, c.email, b.name AS shop, b.language
  INTO v_customer
  FROM public.customers c JOIN public.businesses b ON b.id = c.business_id
  WHERE c.unsubscribe_token = p_token;
  IF v_customer.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Same address may exist more than once in a shop: unsubscribe all of them.
  UPDATE public.customers
     SET newsletter_status = 'unsubscribed', newsletter_changed_at = now()
   WHERE business_id = v_customer.business_id AND lower(btrim(email)) = lower(btrim(v_customer.email));
  UPDATE public.marketing_sends SET status = 'skipped', last_error = 'unsubscribed'
   WHERE business_id = v_customer.business_id AND lower(email) = lower(btrim(v_customer.email)) AND status = 'queued';

  RETURN jsonb_build_object('shop', v_customer.shop, 'language', v_customer.language);
END;
$function$;

REVOKE ALL ON FUNCTION private.next_campaign_run(integer, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_campaign_run(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_due_campaigns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_campaign_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_campaign_now(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.marketing_audience_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketing_audience_counts() TO authenticated;
REVOKE ALL ON FUNCTION public.claim_marketing_sends(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_marketing_send(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketing_unsubscribe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketing_sends(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_marketing_send(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketing_unsubscribe(uuid) TO service_role;

-- 4. Cron ----------------------------------------------------------------------
SELECT cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'send-marketing';

SELECT cron.schedule(
  'send-marketing',
  '*/2 * * * *',
  $job$
  SELECT private.queue_due_campaigns();
  SELECT net.http_post(
    url := (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'project_url') || '/functions/v1/send-marketing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'outbox_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (
    SELECT 1 FROM public.marketing_sends q
    WHERE q.status = 'queued' OR (q.status = 'sending' AND q.locked_at < now() - interval '10 minutes')
  );
  $job$
);
