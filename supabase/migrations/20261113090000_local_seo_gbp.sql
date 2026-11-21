/*
  # Local SEO on Zenno Social: Google Business Profile through Zernio (Phase 1, Jev gbp_core)

  1. social_accounts takes platform 'googlebusiness' plus the listing's public
     links (review link for guests, Maps link) and its primary category.
  2. Rollout flag: private.local_seo_pilot lists the shops that see local SEO.
     public.business_has_local_seo() = business_has_social() AND on the pilot list.
     Turn a shop on:  INSERT INTO private.local_seo_pilot (business_id) VALUES ('…');
  3. gbp_settings: per shop auto-reply (4–5 stars) and profile sync switches, and
     the sync queue (sync_due_at), set by triggers on hours and services.
  4. gbp_reviews: mirror of Google reviews with the AI draft the owner approves.
  5. gbp_posts: weekly Google posts (draft → scheduled/published through Zernio).
  6. Hours/services changes mark the shop's profile for sync; cron 'local-seo-sync'
     calls the edge function every 5 minutes while something is due.
  7. CRM automation kind 'review_request': emails the Google review link the day
     after a completed visit, once per customer, to subscribers only (in Germany a
     review request counts as advertising, BGH VI ZR 225/17).

  All tables are written by the service role (edge functions local-seo-admin,
  local-seo-sync, social-webhook); admins read their own shop.
*/

-- 1. Accounts --------------------------------------------------------------------
ALTER TABLE public.social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;
ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_platform_check
  CHECK (platform IN ('instagram', 'facebook', 'googlebusiness'));

ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS review_url text CHECK (review_url IS NULL OR (char_length(review_url) <= 2000 AND review_url LIKE 'https://%')),
  ADD COLUMN IF NOT EXISTS maps_url text CHECK (maps_url IS NULL OR (char_length(maps_url) <= 2000 AND maps_url LIKE 'https://%')),
  ADD COLUMN IF NOT EXISTS location_category text CHECK (location_category IS NULL OR char_length(location_category) <= 200);

-- 2. Rollout flag ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.local_seo_pilot (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.local_seo_pilot FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.business_has_local_seo(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT public.business_has_social(p_business_id)
     AND EXISTS (SELECT 1 FROM private.local_seo_pilot p WHERE p.business_id = p_business_id);
$function$;

REVOKE ALL ON FUNCTION public.business_has_local_seo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_has_local_seo(uuid) TO authenticated, service_role;

-- 3. Settings + sync queue ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gbp_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  auto_reply_positive boolean NOT NULL DEFAULT false,
  -- Auto-reply only answers reviews written after it was switched on (no backfill of old ones).
  auto_reply_since timestamptz,
  sync_hours boolean NOT NULL DEFAULT true,
  sync_services boolean NOT NULL DEFAULT true,
  sync_due_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text CHECK (last_sync_error IS NULL OR char_length(last_sync_error) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gbp_settings ADD COLUMN IF NOT EXISTS auto_reply_since timestamptz;
CREATE INDEX IF NOT EXISTS gbp_settings_due_idx ON public.gbp_settings (sync_due_at) WHERE sync_due_at IS NOT NULL;

-- 4. Reviews ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gbp_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_id text NOT NULL CHECK (char_length(account_id) BETWEEN 1 AND 64),
  review_id text NOT NULL CHECK (char_length(review_id) BETWEEN 1 AND 200),
  reviewer_name text CHECK (reviewer_name IS NULL OR char_length(reviewer_name) <= 200),
  rating smallint NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 5000),
  reviewed_at timestamptz,
  reply_text text CHECK (reply_text IS NULL OR char_length(reply_text) <= 4096),
  replied_at timestamptz,
  reply_source text CHECK (reply_source IS NULL OR reply_source IN ('owner', 'auto', 'google')),
  draft_text text CHECK (draft_text IS NULL OR char_length(draft_text) <= 4096),
  drafted_at timestamptz,
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, review_id)
);
CREATE INDEX IF NOT EXISTS gbp_reviews_business_idx ON public.gbp_reviews (business_id, reviewed_at DESC);

-- 5. Posts --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gbp_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  account_id text NOT NULL CHECK (char_length(account_id) BETWEEN 1 AND 64),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1500),
  topic text CHECK (topic IS NULL OR char_length(topic) <= 200),
  cta_type text CHECK (cta_type IS NULL OR cta_type IN ('BOOK', 'LEARN_MORE', 'ORDER', 'SHOP', 'SIGN_UP', 'CALL')),
  cta_url text CHECK (cta_url IS NULL OR (char_length(cta_url) <= 2000 AND cta_url LIKE 'https://%')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  zernio_post_id text CHECK (zernio_post_id IS NULL OR char_length(zernio_post_id) <= 64),
  post_url text CHECK (post_url IS NULL OR char_length(post_url) <= 2000),
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'scheduled' OR scheduled_for IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS gbp_posts_business_idx ON public.gbp_posts (business_id, created_at DESC);

ALTER TABLE public.gbp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read their shop" ON public.gbp_settings;
CREATE POLICY "Admins read their shop" ON public.gbp_settings
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());
DROP POLICY IF EXISTS "Admins read their shop" ON public.gbp_reviews;
CREATE POLICY "Admins read their shop" ON public.gbp_reviews
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());
DROP POLICY IF EXISTS "Admins read their shop" ON public.gbp_posts;
CREATE POLICY "Admins read their shop" ON public.gbp_posts
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());

REVOKE ALL ON public.gbp_settings, public.gbp_reviews, public.gbp_posts FROM anon, authenticated;
GRANT SELECT ON public.gbp_settings, public.gbp_reviews, public.gbp_posts TO authenticated;

/** Gives back one AI credit when a draft failed after consume_ai_reply (service role). */
CREATE OR REPLACE FUNCTION public.refund_ai_reply(p_business_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.ai_credit_accounts
     SET used_in_period = greatest(used_in_period - 1, 0), updated_at = now()
   WHERE business_id = p_business_id;
$$;
REVOKE ALL ON FUNCTION public.refund_ai_reply(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_reply(uuid) TO service_role;

-- 6. Profile sync on hours / services changes ----------------------------------------
-- A short delay batches a burst of edits (saving a week of hours touches 7 rows).
CREATE OR REPLACE FUNCTION private.mark_gbp_sync_due()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_business uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.business_id ELSE NEW.business_id END;
BEGIN
  IF v_business IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.social_accounts a
    WHERE a.business_id = v_business AND a.platform = 'googlebusiness' AND a.is_active
  ) THEN
    INSERT INTO public.gbp_settings (business_id, sync_due_at)
    VALUES (v_business, now() + interval '2 minutes')
    ON CONFLICT (business_id) DO UPDATE SET sync_due_at = now() + interval '2 minutes', updated_at = now();
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION private.mark_gbp_sync_due() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gbp_sync_working_hours ON public.working_hours;
CREATE TRIGGER gbp_sync_working_hours AFTER INSERT OR UPDATE OR DELETE ON public.working_hours
  FOR EACH ROW EXECUTE FUNCTION private.mark_gbp_sync_due();
DROP TRIGGER IF EXISTS gbp_sync_specialists ON public.specialists;
CREATE TRIGGER gbp_sync_specialists AFTER INSERT OR UPDATE OF is_active OR DELETE ON public.specialists
  FOR EACH ROW EXECUTE FUNCTION private.mark_gbp_sync_due();
DROP TRIGGER IF EXISTS gbp_sync_services ON public.services;
CREATE TRIGGER gbp_sync_services AFTER INSERT OR UPDATE OF name, description, is_hidden OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION private.mark_gbp_sync_due();
DROP TRIGGER IF EXISTS gbp_sync_service_durations ON public.service_durations;
CREATE TRIGGER gbp_sync_service_durations AFTER INSERT OR UPDATE OF price_cents OR DELETE ON public.service_durations
  FOR EACH ROW EXECUTE FUNCTION private.mark_gbp_sync_due();

SELECT cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'local-seo-sync';

SELECT cron.schedule(
  'local-seo-sync',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'project_url') || '/functions/v1/local-seo-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'outbox_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (SELECT 1 FROM public.gbp_settings g WHERE g.sync_due_at <= now());
  $job$
);

-- 7. CRM automation: review request after a completed visit --------------------------
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS days_after integer NOT NULL DEFAULT 1;
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_days_after_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_days_after_check
  CHECK (days_after BETWEEN 0 AND 14);
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_kind_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_kind_check
  CHECK (kind IN ('monthly', 'special_day', 'birthday', 'winback', 'review_request'));

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

  ELSIF v_campaign.kind = 'review_request' AND public.business_has_local_seo(v_campaign.business_id) THEN
    -- Once per customer ever (Google takes one review per person); subscribers only.
    -- A 3-day window catches a missed day without mailing old visits on first switch-on.
    INSERT INTO public.marketing_sends (campaign_id, business_id, customer_id, email, run_key)
    SELECT DISTINCT ON (lower(btrim(c.email))) v_campaign.id, v_campaign.business_id, c.id, btrim(c.email), 'review'
    FROM public.customers c
    JOIN public.customer_stats s ON s.customer_id = c.id
    WHERE c.business_id = v_campaign.business_id
      AND c.email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      AND c.newsletter_status = 'subscribed'
      AND s.last_visit_date BETWEEN v_today - (v_campaign.days_after + 3) AND v_today - v_campaign.days_after
      AND NOT EXISTS (
        SELECT 1 FROM public.marketing_sends earlier
        WHERE earlier.campaign_id = v_campaign.id AND lower(earlier.email) = lower(btrim(c.email))
      )
    ORDER BY lower(btrim(c.email)), c.created_at
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
    IF v_campaign.kind IN ('birthday', 'winback', 'review_request') THEN
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
  IF v_kind IN ('birthday', 'winback', 'review_request') THEN
    RAISE EXCEPTION 'Automatic emails send themselves' USING ERRCODE = '22023';
  END IF;
  RETURN private.queue_campaign_run(p_campaign_id, 'now-' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD'));
END;
$function$;

-- The review request is a Social feature: only shops with local SEO can switch it on.
CREATE OR REPLACE FUNCTION private.guard_review_request_campaign()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.kind = 'review_request' AND NEW.is_active
     AND (TG_OP = 'INSERT' OR NOT OLD.is_active OR OLD.kind IS DISTINCT FROM NEW.kind)
     AND NOT public.business_has_local_seo(NEW.business_id) THEN
    RAISE EXCEPTION 'Google review requests are part of Zenno Social' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_review_request_campaign() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_review_request_campaign ON public.marketing_campaigns;
CREATE TRIGGER guard_review_request_campaign BEFORE INSERT OR UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION private.guard_review_request_campaign();

REVOKE ALL ON FUNCTION private.queue_automation_run(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.queue_due_campaigns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_campaign_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_campaign_now(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
