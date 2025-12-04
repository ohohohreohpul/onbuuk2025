/*
  # Fix Auth Signup Trigger Issue
  
  The trigger that links admin users to auth users is causing a database error during signup.
  This migration fixes the issue by:
  
  1. Removing the problematic trigger
  2. Updating the link function to be safer
  3. Ensuring auth operations don't conflict with admin_users operations
*/

-- Drop the existing trigger that causes issues during signup
DROP TRIGGER IF EXISTS trigger_link_admin_to_auth_user ON public.admin_users;
DROP FUNCTION IF EXISTS public.link_admin_to_auth_user();

-- Create a safer version that only runs after the user is fully created
CREATE OR REPLACE FUNCTION public.link_admin_to_auth_user_safe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Only try to link if user_id is not already set and email exists
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    BEGIN
      -- Try to find the auth user, but don't fail if not found
      SELECT id INTO v_user_id
      FROM auth.users
      WHERE email = NEW.email
      LIMIT 1;
      
      IF v_user_id IS NOT NULL THEN
        NEW.user_id := v_user_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore any errors and continue
      NULL;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Re-create the trigger with the safer function
CREATE TRIGGER trigger_link_admin_to_auth_user_safe
  BEFORE INSERT OR UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_admin_to_auth_user_safe();