/*
  # Zenno Social (69 €/month): Instagram + Facebook through Zernio

  Zernio (zernio.com) holds the Meta app, the OAuth connections and the inbox.
  Zenno keeps one Zernio profile per shop (externalId = business id) and mirrors
  the connected accounts so webhooks can be routed and replies sent.

  1. Plan 'social': everything in the Zenno plan plus social. business_is_paid()
     counts it; business_has_social() gates the social features (custom too).
  2. social_profiles / social_accounts: written by the service role only
     (edge functions social-admin and social-webhook); admins read their shop.
  3. AI receptionist: channels 'instagram' and 'facebook'. A conversation
     remembers which connected account it belongs to (external_account_id), so
     the reply goes out through the same account.
*/

-- 1. Plan --------------------------------------------------------------------------
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_plan_type_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_plan_type_check
  CHECK (plan_type IN ('free', 'starter', 'standard', 'pro', 'social', 'custom'));

CREATE OR REPLACE FUNCTION public.business_is_paid(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id
      AND (b.plan_type = 'custom'
        OR (b.plan_type IN ('pro', 'standard', 'social') AND b.subscription_status IN ('active', 'trialing', 'past_due')))
  );
$function$;

CREATE OR REPLACE FUNCTION public.business_has_social(p_business_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id
      AND (b.plan_type = 'custom'
        OR (b.plan_type = 'social' AND b.subscription_status IN ('active', 'trialing', 'past_due')))
  );
$function$;

REVOKE ALL ON FUNCTION public.business_has_social(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_has_social(uuid) TO authenticated, service_role;

-- 2. Zernio mirror -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_profiles (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  zernio_profile_id text NOT NULL UNIQUE CHECK (char_length(zernio_profile_id) BETWEEN 1 AND 64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  zernio_account_id text NOT NULL UNIQUE CHECK (char_length(zernio_account_id) BETWEEN 1 AND 64),
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  username text CHECK (username IS NULL OR char_length(username) <= 200),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 200),
  picture_url text CHECK (picture_url IS NULL OR char_length(picture_url) <= 2000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_accounts_business_idx ON public.social_accounts (business_id);

ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read their shop" ON public.social_profiles;
CREATE POLICY "Admins read their shop" ON public.social_profiles
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());
DROP POLICY IF EXISTS "Admins read their shop" ON public.social_accounts;
CREATE POLICY "Admins read their shop" ON public.social_accounts
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());

REVOKE ALL ON public.social_profiles, public.social_accounts FROM anon, authenticated;
GRANT SELECT ON public.social_profiles, public.social_accounts TO authenticated;

-- 3. Receptionist channels --------------------------------------------------------------
ALTER TABLE public.receptionist_conversations DROP CONSTRAINT IF EXISTS receptionist_conversations_channel_check;
ALTER TABLE public.receptionist_conversations ADD CONSTRAINT receptionist_conversations_channel_check
  CHECK (channel IN ('web', 'email', 'whatsapp', 'instagram', 'facebook'));
ALTER TABLE public.receptionist_conversations
  ADD COLUMN IF NOT EXISTS external_account_id text CHECK (external_account_id IS NULL OR char_length(external_account_id) <= 64);

ALTER TABLE public.receptionist_settings
  ADD COLUMN IF NOT EXISTS social_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS social_mode text NOT NULL DEFAULT 'auto';
ALTER TABLE public.receptionist_settings DROP CONSTRAINT IF EXISTS receptionist_settings_social_mode_check;
ALTER TABLE public.receptionist_settings ADD CONSTRAINT receptionist_settings_social_mode_check
  CHECK (social_mode IN ('auto', 'drafts'));

-- 4. Billing overview knows the Social plan ------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_billing_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business uuid := public.get_admin_business_id();
  v_month date := date_trunc('month', now() AT TIME ZONE 'Europe/Berlin')::date;
  b public.businesses;
  a public.ai_credit_accounts;
BEGIN
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.businesses WHERE id = v_business;
  SELECT * INTO a FROM public.ai_credit_accounts WHERE business_id = v_business;
  RETURN jsonb_build_object(
    'plan', CASE WHEN b.plan_type = 'custom' THEN 'custom'
                 WHEN public.business_has_social(v_business) THEN 'social'
                 WHEN public.business_is_paid(v_business) THEN 'pro'
                 ELSE 'free' END,
    'subscription_status', b.subscription_status,
    'has_subscription', b.stripe_subscription_id IS NOT NULL,
    'allowance', private.ai_monthly_allowance(v_business),
    'used', CASE WHEN a.period_month = v_month THEN a.used_in_period ELSE 0 END,
    'purchased', coalesce(a.purchased_replies, 0)
  );
END;
$$;
