/*
  Admin panel language per person (Jev decision 2026-10-14: per user, stored in DB).
  admin_users.ui_language: 'en' | 'de' | 'th', NULL = follow the browser.
  Users set their own value through set_my_ui_language(); the admin_users
  guard does not restrict this column.
*/
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS ui_language text;
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_ui_language_check;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_ui_language_check
  CHECK (ui_language IS NULL OR ui_language IN ('en', 'de', 'th'));

CREATE OR REPLACE FUNCTION public.set_my_ui_language(p_language text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF p_language IS NOT NULL AND p_language NOT IN ('en', 'de', 'th') THEN
    RAISE EXCEPTION 'Unsupported language: %', p_language USING ERRCODE = '22023';
  END IF;
  UPDATE public.admin_users SET ui_language = p_language WHERE user_id = auth.uid();
END;
$function$;

REVOKE ALL ON FUNCTION public.set_my_ui_language(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_ui_language(text) TO authenticated;
