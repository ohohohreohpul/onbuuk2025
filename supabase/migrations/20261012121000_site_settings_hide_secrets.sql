/*
  SECURITY: site_settings was fully readable by anyone ("Public can view site
  settings": business_id IS NOT NULL). It holds per-shop secrets
  (stripe_secret_key incl. live keys, paypal_secret) and the buyer data of
  pending PayPal gift-card orders (paypal_temp_gc_<code>).

  Now:
  - everyone may read only non-secret settings (what the booking and gift-card
    pages need: currency, payment switches, PayPal client id, ...)
  - admins read all settings of their own business (Payment settings screen)
  - edge functions use the service role and are not affected.
*/

CREATE OR REPLACE FUNCTION public.is_private_site_setting(p_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_key LIKE 'paypal\_temp\_gc\_%'
      OR p_key ~* '(secret|password|private|api_?key|token|webhook)';
$$;

COMMENT ON FUNCTION public.is_private_site_setting(text) IS
  'site_settings keys that must never be readable outside the business admins and the service role.';

DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public can view non-secret site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can view own business site settings" ON public.site_settings;

CREATE POLICY "Public can view non-secret site settings"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (business_id IS NOT NULL AND NOT public.is_private_site_setting(key));

CREATE POLICY "Admins can view own business site settings"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());
