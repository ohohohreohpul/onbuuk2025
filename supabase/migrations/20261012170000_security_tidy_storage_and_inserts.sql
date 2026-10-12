/*
  Security tidy-up (audit 2026-10-12, Jev: first in the next round).

  1. Storage bucket business-assets: any signed-in user could upload, replace or
     delete any shop's logos and images. Every upload path in the app starts with
     the shop id ("<business_id>/branding/...", ".../products/...", ...), so writes
     now require that first folder to be the caller's own shop. Only image types.
  2. customer_gift_cards: claims could be inserted for any customer record. Now
     only for your own customer record (the code check stays in
     find_gift_card_for_claim).
  3. Tables where anyone could insert rows for any shop:
     - booking_gift_cards: written only by the SECURITY DEFINER redemption RPCs.
     - booking_form_colors: sign-up inserts colours after the admin row exists,
       so the existing "own business" policy covers it.
     - audit_log: only for admins of your own shop.
*/

-- 1. Storage ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload business assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their business assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their business assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload own business assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins update own business assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete own business assets" ON storage.objects;

CREATE POLICY "Admins upload own business assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = get_admin_business_id()::text);

CREATE POLICY "Admins update own business assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = get_admin_business_id()::text)
  WITH CHECK (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = get_admin_business_id()::text);

CREATE POLICY "Admins delete own business assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-assets' AND (storage.foldername(name))[1] = get_admin_business_id()::text);

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'],
    file_size_limit = 10485760
WHERE id = 'business-assets';

-- 2. Gift card claims -----------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert claimed cards" ON public.customer_gift_cards;
DROP POLICY IF EXISTS "Customers claim cards for themselves" ON public.customer_gift_cards;
CREATE POLICY "Customers claim cards for themselves"
  ON public.customer_gift_cards FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = auth.uid()));

-- 3. Open inserts -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can insert booking gift cards" ON public.booking_gift_cards;
DROP POLICY IF EXISTS "Public can create booking form colors" ON public.booking_form_colors;
DROP POLICY IF EXISTS "Authenticated users can create booking colors" ON public.booking_form_colors;

DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Admins write own business audit logs" ON public.audit_log;
CREATE POLICY "Admins write own business audit logs"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (admin_user_id IN (SELECT au.id FROM public.admin_users au WHERE au.business_id = get_admin_business_id()));
