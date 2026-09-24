/*
  Payment configuration is an owner-controlled boundary.

  - Public booking pages may read non-secret settings.
  - Secret values are visible only to the authenticated owner of that business.
  - All payment-category writes are owner-only.
  - Other business settings remain editable by authenticated members of that business.
*/

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_business_owner(target_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users AS admin_user
    WHERE admin_user.business_id = target_business_id
      AND admin_user.is_active = true
      AND admin_user.role = 'owner'
      AND (
        admin_user.auth_user_id = (SELECT auth.uid())
        OR admin_user.user_id = (SELECT auth.uid())
        OR admin_user.email = (SELECT auth.jwt() ->> 'email')
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_business_owner(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_business_owner(uuid) TO authenticated;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON public.site_settings;
DROP POLICY IF EXISTS "Authenticated users can manage site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Site settings viewable by business" ON public.site_settings;
DROP POLICY IF EXISTS "Authenticated users can manage their business settings" ON public.site_settings;
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can update site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can delete site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Users can insert site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Users can update site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Users can delete site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can delete own business site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can update own business site settings" ON public.site_settings;

REVOKE ALL ON TABLE public.site_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.site_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_settings TO authenticated;

CREATE POLICY "Public can view non-secret site settings"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    lower(key) NOT LIKE '%secret%'
    AND lower(key) NOT LIKE '%private_key%'
  );

CREATE POLICY "Owners can view payment secrets"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (
    (
      lower(key) LIKE '%secret%'
      OR lower(key) LIKE '%private_key%'
    )
    AND private.is_business_owner(business_id)
  );

CREATE POLICY "Business members can insert non-payment settings"
  ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id = public.get_admin_business_id()
    AND coalesce(category, '') <> 'payment'
    AND lower(key) NOT LIKE '%secret%'
    AND lower(key) NOT LIKE '%private_key%'
  );

CREATE POLICY "Business members can update non-payment settings"
  ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING (
    business_id = public.get_admin_business_id()
    AND coalesce(category, '') <> 'payment'
    AND lower(key) NOT LIKE '%secret%'
    AND lower(key) NOT LIKE '%private_key%'
  )
  WITH CHECK (
    business_id = public.get_admin_business_id()
    AND coalesce(category, '') <> 'payment'
    AND lower(key) NOT LIKE '%secret%'
    AND lower(key) NOT LIKE '%private_key%'
  );

CREATE POLICY "Business members can delete non-payment settings"
  ON public.site_settings
  FOR DELETE
  TO authenticated
  USING (
    business_id = public.get_admin_business_id()
    AND coalesce(category, '') <> 'payment'
    AND lower(key) NOT LIKE '%secret%'
    AND lower(key) NOT LIKE '%private_key%'
  );

CREATE POLICY "Owners can insert payment settings"
  ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coalesce(category, '') = 'payment'
    AND private.is_business_owner(business_id)
  );

CREATE POLICY "Owners can update payment settings"
  ON public.site_settings
  FOR UPDATE
  TO authenticated
  USING (
    coalesce(category, '') = 'payment'
    AND private.is_business_owner(business_id)
  )
  WITH CHECK (
    coalesce(category, '') = 'payment'
    AND private.is_business_owner(business_id)
  );

CREATE POLICY "Owners can delete payment settings"
  ON public.site_settings
  FOR DELETE
  TO authenticated
  USING (
    coalesce(category, '') = 'payment'
    AND private.is_business_owner(business_id)
  );
