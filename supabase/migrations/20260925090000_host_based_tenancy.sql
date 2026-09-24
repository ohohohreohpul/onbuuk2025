/*
  Host-based tenancy.

  The hostname is the only thing that decides which business a shop page
  belongs to:
    salon-a.zennohq.studio   -> business with permalink 'salon-a'
    salon-a.de               -> verified row in custom_domains
    book.zennohq.studio      -> the platform app (admin, login, sign-up); no tenant

  Previously the browser picked the business from the first path segment
  (/salon-a) or from localStorage, so any host could render any business.

  This migration:
  1. Lists platform hosts (app hosts and shop base domains) in one table.
  2. Reserves platform labels (www, app, book, ...) and enforces that permalinks
     are valid DNS labels, since they are now subdomains.
  3. Carries the one working legacy address (oh.onbuuk.com) into custom_domains.
  4. Adds resolve_tenant(host): the single, server-side lookup the app uses.
*/

-- 1. Platform hosts ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_hosts (
  host text PRIMARY KEY CHECK (host = lower(host) AND host !~ '[/:\s]'),
  purpose text NOT NULL CHECK (purpose IN ('app', 'shop_base', 'legacy_app')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_hosts_one_primary_per_purpose
  ON public.platform_hosts (purpose) WHERE is_primary;

INSERT INTO public.platform_hosts (host, purpose, is_primary) VALUES
  ('book.zennohq.studio', 'app', true),
  ('zennohq.studio', 'shop_base', true),
  ('localhost', 'shop_base', false),        -- local development: salon-a.localhost
  ('onbuuk.com', 'legacy_app', false),
  ('www.onbuuk.com', 'legacy_app', false),
  ('app.onbuuk.com', 'legacy_app', false)
ON CONFLICT (host) DO NOTHING;

ALTER TABLE public.platform_hosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform hosts are public" ON public.platform_hosts;
CREATE POLICY "Platform hosts are public"
  ON public.platform_hosts FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.platform_hosts TO anon, authenticated;

-- 2. Permalinks are subdomains now ----------------------------------------

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_permalink_dns_label;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_permalink_dns_label CHECK (
    permalink ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
    AND permalink <> ALL (ARRAY[
      'www', 'app', 'api', 'book', 'booking', 'admin', 'superadmin', 'staff',
      'login', 'signup', 'register', 'account', 'accounts', 'auth', 'dashboard',
      'mail', 'email', 'smtp', 'imap', 'ftp', 'cdn', 'static', 'assets', 'media',
      'status', 'docs', 'help', 'support', 'blog', 'pay', 'payments', 'billing',
      'shop', 'store', 'studio', 'zenno', 'onbuuk', 'buuk', 'test', 'demo'
    ])
  ) NOT VALID;

-- Existing rows were checked before writing this (all 79 valid, no reserved
-- names), so validate now; this fails loudly if that ever stops being true.
ALTER TABLE public.businesses VALIDATE CONSTRAINT businesses_permalink_dns_label;

-- 3. Custom domains -------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS custom_domains_domain_lower_key
  ON public.custom_domains (lower(domain));

CREATE UNIQUE INDEX IF NOT EXISTS custom_domains_one_primary_per_business
  ON public.custom_domains (business_id) WHERE is_primary AND status = 'verified';

-- The only working legacy per-business address. businesses.custom_domain values
-- equal to a platform host (app.onbuuk.com) are not real custom domains.
INSERT INTO public.custom_domains (business_id, domain, status, verified_at, is_primary)
SELECT b.id, lower(b.custom_domain), 'verified', now(), true
FROM public.businesses b
WHERE b.custom_domain IS NOT NULL
  AND lower(b.custom_domain) NOT IN (SELECT host FROM public.platform_hosts)
  AND NOT EXISTS (SELECT 1 FROM public.custom_domains cd WHERE lower(cd.domain) = lower(b.custom_domain));

COMMENT ON COLUMN public.businesses.custom_domain IS
  'LEGACY. Use public.custom_domains (verified rows) and resolve_tenant(host).';

-- 3b. Custom domains are a paid feature --------------------------------------
-- An explicit entitlement, not derived from plan_type: billing data does not
-- reliably say who pays (most "pro" rows have no Stripe subscription).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS custom_domain_enabled boolean NOT NULL DEFAULT false;

-- Initial grant: premium plans plus anyone with a working custom domain today.
-- The platform owner adjusts this list from Super Admin.
UPDATE public.businesses b
SET custom_domain_enabled = true
WHERE b.plan_type IN ('pro', 'premium')
   OR EXISTS (SELECT 1 FROM public.custom_domains cd WHERE cd.business_id = b.id AND cd.status = 'verified');

COMMENT ON COLUMN public.businesses.custom_domain_enabled IS
  'Entitlement for custom domains. Only the platform (service role / super admin) may change it.';

-- 3c. Billing and entitlement fields are platform-controlled -------------------
-- Business admins may edit their own business row (name, branding, ...), which
-- previously included plan_type: anyone could make themselves "pro".
CREATE OR REPLACE FUNCTION private.protect_business_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  -- Direct database sessions (migrations, SQL editor) carry no API JWT.
  v_is_api_request boolean := coalesce(current_setting('request.jwt.claims', true), '') <> '';
  v_is_privileged boolean := NOT v_is_api_request
    OR coalesce((SELECT auth.role()), '') = 'service_role'
    OR public.is_super_admin();
BEGIN
  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan_type := 'free';
    NEW.custom_domain_enabled := false;
    NEW.stripe_subscription_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type
     OR NEW.custom_domain_enabled IS DISTINCT FROM OLD.custom_domain_enabled
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.trial_end_date IS DISTINCT FROM OLD.trial_end_date THEN
    RAISE EXCEPTION 'Plan and billing details can only be changed through billing.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.protect_business_billing_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_business_billing_fields ON public.businesses;
CREATE TRIGGER protect_business_billing_fields
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION private.protect_business_billing_fields();

-- 4. Resolver -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_tenant(p_host text)
RETURNS TABLE (
  business_id uuid,
  business_name text,
  permalink text,
  plan_type text,
  match_type text,
  primary_host text,
  is_primary_host boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_host text := rtrim(lower(split_part(btrim(coalesce(p_host, '')), ':', 1)), '.');
  v_business public.businesses%ROWTYPE;
  v_match text;
  v_base text;
  v_label text;
  v_primary text;
BEGIN
  IF v_host = '' OR length(v_host) > 253 THEN
    RETURN;
  END IF;

  -- a) A verified custom domain.
  SELECT b.* INTO v_business
  FROM public.custom_domains cd
  JOIN public.businesses b ON b.id = cd.business_id
  WHERE lower(cd.domain) = v_host AND cd.status = 'verified'
    AND b.is_active = true AND b.custom_domain_enabled = true;

  IF FOUND THEN
    v_match := 'custom_domain';
  ELSE
    -- b) <permalink>.<shop base>, exactly one label deep.
    SELECT ph.host INTO v_base
    FROM public.platform_hosts ph
    WHERE ph.purpose = 'shop_base' AND v_host LIKE '%.' || ph.host
    ORDER BY length(ph.host) DESC
    LIMIT 1;

    IF v_base IS NULL THEN
      RETURN;
    END IF;

    v_label := left(v_host, length(v_host) - length(v_base) - 1);
    IF v_label = '' OR position('.' IN v_label) > 0 THEN
      RETURN;
    END IF;

    SELECT b.* INTO v_business
    FROM public.businesses b
    WHERE b.permalink = v_label AND b.is_active = true;

    IF NOT FOUND THEN
      RETURN;
    END IF;
    v_match := 'platform_subdomain';
  END IF;

  -- Primary address: a verified primary custom domain (while entitled),
  -- else the platform subdomain. Losing the entitlement falls back gracefully.
  IF v_business.custom_domain_enabled THEN
    SELECT lower(cd.domain) INTO v_primary
    FROM public.custom_domains cd
    WHERE cd.business_id = v_business.id AND cd.status = 'verified' AND cd.is_primary
    LIMIT 1;
  END IF;

  IF v_primary IS NULL THEN
    v_primary := v_business.permalink || '.' || COALESCE(
      v_base,
      (SELECT host FROM public.platform_hosts WHERE purpose = 'shop_base' AND is_primary LIMIT 1)
    );
  END IF;

  RETURN QUERY SELECT
    v_business.id,
    v_business.name,
    v_business.permalink,
    v_business.plan_type::text,
    v_match,
    v_primary,
    v_primary = v_host;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tenant(text) TO anon, authenticated;

COMMENT ON FUNCTION public.resolve_tenant(text) IS
  'Maps a request hostname to exactly one active business (or none). The only tenant lookup the storefront uses.';
