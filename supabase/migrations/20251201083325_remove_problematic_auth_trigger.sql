/*
  # Remove Problematic Auth Trigger
  
  The trigger that automatically links admin_users to auth.users is causing
  "Database error saving new user" during signup because it creates a circular
  dependency during the auth signup process.
  
  Solution: Remove the trigger entirely and handle user linking manually in the
  application code after auth signup completes successfully.
*/

-- Remove the problematic trigger completely
DROP TRIGGER IF EXISTS trigger_link_admin_to_auth_user_safe ON public.admin_users;
DROP FUNCTION IF EXISTS public.link_admin_to_auth_user_safe();

-- Update the create_admin_user function to not depend on the trigger
-- It already handles user_id lookup manually, so this is safer
