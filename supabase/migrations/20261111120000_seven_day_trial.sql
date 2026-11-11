/*
  7-day free trial for new sign-ups (2026-11-11, decided by Jev:
  scripts/decisions/2026-11-11-seven-day-trial.json).

  New shops no longer start on the permanent Free plan: they must start the
  Zenno plan with a 7-day Stripe trial (card required, charged on day 8) before
  they can use the dashboard. Shops that exist today keep Free as it is.

  - businesses.plan_required: true for shops created from now on, false for
    every existing shop. Only billing (service role) may change it.
  - get_billing_overview() also returns needs_plan, trial_available and trial_end.
  The trial itself is Stripe's (status 'trialing'), which business_is_paid()
  already treats as paid.
*/

-- 1. Which shops must choose a plan ---------------------------------------------------
-- Added with default false so existing shops are grandfathered, then new rows default to true.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS plan_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.businesses ALTER COLUMN plan_required SET DEFAULT true;

-- 2. Owners cannot clear it themselves -------------------------------------------------
CREATE OR REPLACE FUNCTION private.protect_business_billing_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    NEW.plan_required := true;
    RETURN NEW;
  END IF;

  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type
     OR NEW.custom_domain_enabled IS DISTINCT FROM OLD.custom_domain_enabled
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.trial_end_date IS DISTINCT FROM OLD.trial_end_date
     OR NEW.plan_required IS DISTINCT FROM OLD.plan_required THEN
    RAISE EXCEPTION 'Plan and billing details can only be changed through billing.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Billing overview knows about the trial -------------------------------------------
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
  v_is_paid boolean;
BEGIN
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.businesses WHERE id = v_business;
  SELECT * INTO a FROM public.ai_credit_accounts WHERE business_id = v_business;
  v_is_paid := public.business_is_paid(v_business);
  RETURN jsonb_build_object(
    'plan', CASE WHEN b.plan_type = 'custom' THEN 'custom'
                 WHEN public.business_has_social(v_business) THEN 'social'
                 WHEN v_is_paid THEN 'pro'
                 ELSE 'free' END,
    'subscription_status', b.subscription_status,
    'has_subscription', b.stripe_subscription_id IS NOT NULL,
    'allowance', private.ai_monthly_allowance(v_business),
    'used', CASE WHEN a.period_month = v_month THEN a.used_in_period ELSE 0 END,
    'purchased', coalesce(a.purchased_replies, 0),
    -- A new shop without a plan sees the "start your trial" screen instead of the dashboard.
    'needs_plan', b.plan_required AND NOT v_is_paid,
    -- Display hint only; upgrade-subscription checks Stripe before granting a trial.
    'trial_available', b.trial_end_date IS NULL AND b.stripe_subscription_id IS NULL,
    'trial_end', CASE WHEN b.subscription_status = 'trialing' THEN b.trial_end_date END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_billing_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_overview() TO authenticated;

NOTIFY pgrst, 'reload schema';
