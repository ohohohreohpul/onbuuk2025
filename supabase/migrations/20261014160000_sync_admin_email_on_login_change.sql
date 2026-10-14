/*
  # Keep admin_users.email in step with the login email

  Changing the email in Account Settings only changed auth.users. The admin
  record kept the old email, so the dashboard (which finds the shop by email)
  no longer matched and the app created a brand-new empty shop instead.

  1. admin_users_guard: an email change is now allowed when the new value is
     exactly the linked login's email (nothing else can be set this way).
  2. Trigger on auth.users: once a new email is confirmed, copy it to that
     user's active admin records.
*/

CREATE OR REPLACE FUNCTION private.admin_users_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  email_matches_login boolean := false;
BEGIN
  NEW.password_hash := NULL;  -- passwords live in Supabase Auth only

  IF TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email AND NEW.user_id IS NOT NULL THEN
    SELECT lower(u.email) = lower(NEW.email) INTO email_matches_login
    FROM auth.users u WHERE u.id = NEW.user_id;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(auth.role(), '') <> 'service_role' AND (
       NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
    OR (NEW.email IS DISTINCT FROM OLD.email AND NOT COALESCE(email_matches_login, false))
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

CREATE OR REPLACE FUNCTION private.sync_admin_email_from_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  BEGIN
    UPDATE public.admin_users
       SET email = NEW.email
     WHERE user_id = NEW.id
       AND is_active
       AND lower(email) IS DISTINCT FROM lower(NEW.email);
  EXCEPTION WHEN unique_violation THEN
    -- Another admin record already uses this email; never block the login change.
    RAISE WARNING 'admin email sync skipped for user %: email already used by another admin record', NEW.id;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_admin_email_from_auth ON auth.users;
CREATE TRIGGER sync_admin_email_from_auth
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL)
  EXECUTE FUNCTION private.sync_admin_email_from_auth();
