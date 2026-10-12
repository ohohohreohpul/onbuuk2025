/*
  Email provider secrets become write-only for the browser.

  Before: admins' browsers loaded email_settings.api_key and smtp_password back
  into the page (select '*'). Anyone with a stolen admin session or an XSS could
  copy the shop's mail credentials.

  Now the app can write them but never read them back; has_api_key /
  has_smtp_password tell the settings screen whether one is stored. The sending
  functions use the service role and still read everything.
*/

ALTER TABLE public.email_settings
  ADD COLUMN IF NOT EXISTS has_api_key boolean
    GENERATED ALWAYS AS (COALESCE(api_key, '') <> '') STORED,
  ADD COLUMN IF NOT EXISTS has_smtp_password boolean
    GENERATED ALWAYS AS (COALESCE(smtp_password, '') <> '') STORED;

REVOKE SELECT ON public.email_settings FROM anon, authenticated;
GRANT SELECT (
  id, business_id, provider, smtp_host, smtp_port, smtp_username,
  from_email, from_name, is_verified, created_at, updated_at,
  has_api_key, has_smtp_password
) ON public.email_settings TO authenticated;
