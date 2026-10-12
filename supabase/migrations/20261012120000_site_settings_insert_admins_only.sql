/*
  site_settings INSERT was open to everyone (anon included) for any business:
  WITH CHECK (business_id IS NOT NULL). Anyone could create a setting a shop had
  not set yet, e.g. paypal_client_id (payments to someone else's PayPal),
  stripe_enabled, timezone, currency or allowSpecialistChoice.

  Now only the shop's own admins insert, like UPDATE and DELETE already require.
  Sign-up uses initialize_new_business (SECURITY DEFINER) and Stripe Connect uses
  the service role, so neither depends on this policy.
*/

DROP POLICY IF EXISTS "Users can insert site settings" ON public.site_settings;

CREATE POLICY "Admins can insert own business site settings"
  ON public.site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND business_id = get_admin_business_id());
