/*
  The booking success page only promises an email when the shop really sends
  emails (has an email sender). Returns a yes/no, nothing about the settings.
*/
CREATE OR REPLACE FUNCTION public.shop_sends_booking_emails(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.email_settings es WHERE es.business_id = p_business_id);
$$;

REVOKE ALL ON FUNCTION public.shop_sends_booking_emails(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_sends_booking_emails(uuid) TO anon, authenticated;
