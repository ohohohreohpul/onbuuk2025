/*
  SECURITY hardening after the 2026-10-12 audit.

  1. admin_users was readable by anyone (anon), password_hash included; 14 rows
     held plain-text passwords (the paid sign-up stored metadata.user_password).
     Login uses Supabase Auth, so password_hash is unused: it is wiped and kept
     NULL from now on. Public read is replaced by: own record + own team.
     The magic-link page only needs "does this email belong to an admin?" ->
     public.is_admin_email().
  2. Any signed-in user could insert an admin_users row for ANY business (or move
     their own row to another business) and so become its admin. Now a new row
     is only allowed for yourself as the first owner of a business you own, and
     privilege columns can't be changed through the API.
  3. businesses could be inserted by anyone (anon). Now only signed-in users,
     for themselves (owner_id = auth.uid()), like every sign-up form does.
  4. analytics_* views ran as their owner (RLS bypassed) and were readable by
     anon: every shop's revenue and customer stats. The app doesn't use them;
     they become owner-only. Same for get_revenue_by_date_range /
     calculate_period_comparison (no tenant check) and create_super_admin_user
     (anon could create an owner with a chosen password).
  5. gift_card_settings: authenticated policies were `true` (any user could
     read/change every shop's gift-card settings).
*/

-- 1. password_hash --------------------------------------------------------------
UPDATE public.admin_users SET password_hash = NULL WHERE password_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION private.admin_users_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.password_hash := NULL;  -- passwords live in Supabase Auth only

  IF TG_OP = 'UPDATE' AND COALESCE(auth.role(), '') <> 'service_role' AND (
       NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_owner IS DISTINCT FROM OLD.is_owner
    OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
  ) THEN
    RAISE EXCEPTION 'These account fields can only be changed by Zenno support.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.admin_users_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS admin_users_guard ON public.admin_users;
CREATE TRIGGER admin_users_guard
  BEFORE INSERT OR UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION private.admin_users_guard();

-- Read access: own record, own team. No anonymous reads.
DROP POLICY IF EXISTS "Allow login lookup for active admins" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can view own business team" ON public.admin_users;
CREATE POLICY "Admins can view own business team"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    business_id = get_admin_business_id()
    OR user_id = auth.uid()
    OR auth_user_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.is_admin_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE lower(au.email) = lower(trim(p_email)) AND au.is_active
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_email(text) TO anon, authenticated;

-- 2. Who may create admin rows ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_claim_business(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = p_business_id AND b.owner_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.business_id = p_business_id);
$$;

REVOKE ALL ON FUNCTION public.can_claim_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_claim_business(uuid) TO authenticated;

DROP POLICY IF EXISTS "Allow admin user creation during signup" ON public.admin_users;
DROP POLICY IF EXISTS "Authenticated users can create admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Owners create their first admin record" ON public.admin_users;
CREATE POLICY "Owners create their first admin record"
  ON public.admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_claim_business(business_id));

-- 3. businesses insert -------------------------------------------------------------
DROP POLICY IF EXISTS "Allow business creation during signup" ON public.businesses;
DROP POLICY IF EXISTS "Public can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users create their own business" ON public.businesses;
CREATE POLICY "Users create their own business"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 4. Cross-tenant analytics and unsafe functions ------------------------------------
ALTER VIEW public.analytics_booking_stats SET (security_invoker = true);
ALTER VIEW public.analytics_customer_stats SET (security_invoker = true);
ALTER VIEW public.analytics_gift_card_revenue SET (security_invoker = true);
ALTER VIEW public.analytics_revenue_daily SET (security_invoker = true);
ALTER VIEW public.analytics_service_performance SET (security_invoker = true);
ALTER VIEW public.analytics_staff_performance SET (security_invoker = true);
REVOKE ALL ON public.analytics_booking_stats, public.analytics_customer_stats, public.analytics_gift_card_revenue,
  public.analytics_revenue_daily, public.analytics_service_performance, public.analytics_staff_performance
  FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.get_revenue_by_date_range(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_period_comparison(uuid, date, date, date, date) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'create_super_admin_user'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- 5. gift_card_settings: own business only -------------------------------------------
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname, cmd FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'gift_card_settings'
               AND 'authenticated' = ANY(roles) AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
               AND (coalesce(qual, '') = 'true' OR coalesce(with_check, '') = 'true')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.gift_card_settings', pol.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Admins manage own gift card settings" ON public.gift_card_settings;
CREATE POLICY "Admins manage own gift card settings"
  ON public.gift_card_settings
  FOR ALL
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());
