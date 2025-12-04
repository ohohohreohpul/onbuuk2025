/*
  # Temporarily Disable Auth Trigger
  
  To diagnose the "Database error saving new user" issue, we're temporarily
  disabling the auth.users trigger that tries to link customers.
  
  This will help us determine if the trigger is the cause of the issue.
  If signup works without the trigger, we know that's the problem.
*/

-- Disable the trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Keep the function but don't use it (for now)
-- We can re-enable it later once we fix the root cause
