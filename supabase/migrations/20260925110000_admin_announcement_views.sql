/*
  One-time announcements in the admin dashboard (e.g. the ZennoHQ relaunch).
  A row means "this admin has seen this announcement", so it shows once per
  person across devices, not once per browser.
*/

CREATE TABLE IF NOT EXISTS public.admin_announcement_views (
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  announcement_key text NOT NULL CHECK (length(btrim(announcement_key)) BETWEEN 1 AND 80),
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, announcement_key)
);

ALTER TABLE public.admin_announcement_views ENABLE ROW LEVEL SECURITY;

-- An admin can only read and record their own views (identified by auth uid).
DROP POLICY IF EXISTS "Admins read own announcement views" ON public.admin_announcement_views;
CREATE POLICY "Admins read own announcement views"
  ON public.admin_announcement_views FOR SELECT TO authenticated
  USING (admin_user_id IN (
    SELECT id FROM public.admin_users
    WHERE auth_user_id = (SELECT auth.uid()) OR user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Admins record own announcement views" ON public.admin_announcement_views;
CREATE POLICY "Admins record own announcement views"
  ON public.admin_announcement_views FOR INSERT TO authenticated
  WITH CHECK (admin_user_id IN (
    SELECT id FROM public.admin_users
    WHERE auth_user_id = (SELECT auth.uid()) OR user_id = (SELECT auth.uid())
  ));

GRANT SELECT, INSERT ON public.admin_announcement_views TO authenticated;
