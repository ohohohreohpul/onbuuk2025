/*
  Plans and AI credits (2026-10-16).

  Plans: free | pro (the Zenno plan, 49 €/month via Stripe) | custom (tailored, set by Zenno).
  A shop is "paid" when it is custom, or pro/standard with a live Stripe subscription.
  Free: 1 therapist, 5 treatments, no AI receptionist.

  AI credits are counted in AI replies: a paid shop gets a monthly allowance
  (1,000, or its own number for custom), then uses purchased replies. When both
  are used up the AI pauses and messages wait for the team.
*/

-- 1. Plan values -----------------------------------------------------------
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_plan_type_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_plan_type_check CHECK (plan_type IN ('free', 'starter', 'standard', 'pro', 'custom'));

CREATE OR REPLACE FUNCTION public.business_is_paid(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id
      AND (b.plan_type = 'custom'
        OR (b.plan_type IN ('pro', 'standard') AND b.subscription_status IN ('active', 'trialing', 'past_due')))
  );
$$;
REVOKE ALL ON FUNCTION public.business_is_paid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_is_paid(uuid) TO authenticated, service_role;

-- 2. Move shops onto the new plans ------------------------------------------
-- Shops that got a plan label without paying go to Free; the paying one stays paid;
-- SATUUU99, the demo shop and bycoe are tailored (custom).
UPDATE public.businesses SET plan_type = 'custom'
  WHERE name IN ('SATUUU99', 'Zenno Demo Studio', 'bycoe');
UPDATE public.businesses SET plan_type = 'pro'
  WHERE plan_type IN ('standard', 'pro') AND subscription_status IN ('active', 'trialing', 'past_due')
    AND stripe_subscription_id IS NOT NULL AND plan_type <> 'custom';
UPDATE public.businesses SET plan_type = 'free'
  WHERE plan_type IN ('starter', 'standard', 'pro')
    AND NOT (subscription_status IN ('active', 'trialing', 'past_due') AND stripe_subscription_id IS NOT NULL);

-- The AI receptionist is part of the paid plans.
UPDATE public.receptionist_settings SET is_enabled = false
  WHERE is_enabled AND NOT public.business_is_paid(business_id);

-- 3. Free limits, enforced in the database -----------------------------------
CREATE OR REPLACE FUNCTION private.enforce_free_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NEW.business_id IS NULL OR public.business_is_paid(NEW.business_id) THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'specialists' THEN
    SELECT count(*) INTO v_count FROM public.specialists WHERE business_id = NEW.business_id;
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'The free plan includes 1 therapist. Upgrade to the Zenno plan to add more.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'services' THEN
    SELECT count(*) INTO v_count FROM public.services WHERE business_id = NEW.business_id;
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'The free plan includes 5 treatments. Upgrade to the Zenno plan to add more.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_plan_limits ON public.specialists;
CREATE TRIGGER enforce_free_plan_limits BEFORE INSERT ON public.specialists
  FOR EACH ROW EXECUTE FUNCTION private.enforce_free_plan_limits();
DROP TRIGGER IF EXISTS enforce_free_plan_limits ON public.services;
CREATE TRIGGER enforce_free_plan_limits BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION private.enforce_free_plan_limits();

-- 4. AI credits -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_credit_accounts (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  purchased_replies integer NOT NULL DEFAULT 0 CHECK (purchased_replies >= 0),
  period_month date NOT NULL DEFAULT date_trunc('month', now() AT TIME ZONE 'Europe/Berlin')::date,
  used_in_period integer NOT NULL DEFAULT 0 CHECK (used_in_period >= 0),
  monthly_allowance integer CHECK (monthly_allowance IS NULL OR monthly_allowance >= 0), -- custom plans; null = plan default
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  replies integer NOT NULL CHECK (replies > 0),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  stripe_session_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_credit_purchases_business_idx ON public.ai_credit_purchases (business_id, created_at DESC);

ALTER TABLE public.ai_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read own ai credit account" ON public.ai_credit_accounts;
CREATE POLICY "Admins read own ai credit account" ON public.ai_credit_accounts
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());
DROP POLICY IF EXISTS "Admins read own ai credit purchases" ON public.ai_credit_purchases;
CREATE POLICY "Admins read own ai credit purchases" ON public.ai_credit_purchases
  FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id());

CREATE OR REPLACE FUNCTION private.ai_monthly_allowance(p_business_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN public.business_is_paid(p_business_id)
    THEN coalesce((SELECT monthly_allowance FROM public.ai_credit_accounts WHERE business_id = p_business_id), 1000)
    ELSE 0 END;
$$;

/** One AI reply: 'ok' (counted), 'free_plan' or 'no_credits'. Atomic per shop. */
CREATE OR REPLACE FUNCTION public.consume_ai_reply(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_month date := date_trunc('month', now() AT TIME ZONE 'Europe/Berlin')::date;
  v_allowance integer;
  v_account public.ai_credit_accounts;
BEGIN
  IF NOT public.business_is_paid(p_business_id) THEN
    RETURN 'free_plan';
  END IF;
  v_allowance := private.ai_monthly_allowance(p_business_id);
  INSERT INTO public.ai_credit_accounts (business_id) VALUES (p_business_id) ON CONFLICT (business_id) DO NOTHING;
  SELECT * INTO v_account FROM public.ai_credit_accounts WHERE business_id = p_business_id FOR UPDATE;
  IF v_account.period_month <> v_month THEN
    UPDATE public.ai_credit_accounts SET period_month = v_month, used_in_period = 0, updated_at = now() WHERE business_id = p_business_id;
    v_account.used_in_period := 0;
  END IF;
  IF v_account.used_in_period < v_allowance THEN
    UPDATE public.ai_credit_accounts SET used_in_period = used_in_period + 1, updated_at = now() WHERE business_id = p_business_id;
    RETURN 'ok';
  END IF;
  IF v_account.purchased_replies > 0 THEN
    UPDATE public.ai_credit_accounts SET purchased_replies = purchased_replies - 1, updated_at = now() WHERE business_id = p_business_id;
    RETURN 'ok';
  END IF;
  RETURN 'no_credits';
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_reply(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_reply(uuid) TO service_role;

/** Adds purchased replies once per Stripe checkout session (webhook, service role). */
CREATE OR REPLACE FUNCTION public.add_ai_credits(p_business_id uuid, p_replies integer, p_amount_cents integer, p_session_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_replies <= 0 THEN
    RAISE EXCEPTION 'Invalid number of replies';
  END IF;
  INSERT INTO public.ai_credit_purchases (business_id, replies, amount_cents, stripe_session_id)
  VALUES (p_business_id, p_replies, p_amount_cents, p_session_id)
  ON CONFLICT (stripe_session_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN false; -- already counted
  END IF;
  INSERT INTO public.ai_credit_accounts (business_id, purchased_replies) VALUES (p_business_id, p_replies)
  ON CONFLICT (business_id) DO UPDATE SET purchased_replies = public.ai_credit_accounts.purchased_replies + p_replies, updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.add_ai_credits(uuid, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_ai_credits(uuid, integer, integer, text) TO service_role;

/** What the admin sees: plan, trial, allowance, used this month, purchased left. */
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
    'plan', CASE WHEN b.plan_type = 'custom' THEN 'custom' WHEN public.business_is_paid(v_business) THEN 'pro' ELSE 'free' END,
    'subscription_status', b.subscription_status,
    'has_subscription', b.stripe_subscription_id IS NOT NULL,
    'allowance', private.ai_monthly_allowance(v_business),
    'used', CASE WHEN a.period_month = v_month THEN a.used_in_period ELSE 0 END,
    'purchased', coalesce(a.purchased_replies, 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_billing_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_billing_overview() TO authenticated;

NOTIFY pgrst, 'reload schema';
