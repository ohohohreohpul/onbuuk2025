/*
  # Fix Auth User Creation Trigger
  
  The link_customer_to_auth_user() function is causing "Database error saving new user"
  because it's trying to update the customers table during auth signup, but this can
  fail if:
  - RLS policies block the update
  - The function doesn't have proper error handling
  - Search path issues
  
  Solution: Make the function more robust with proper error handling and ensure
  it doesn't fail the auth signup if customer linking fails.
*/

-- Replace the function with a more robust version that won't fail auth signup
CREATE OR REPLACE FUNCTION public.link_customer_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Try to link customer, but don't fail if it doesn't work
  BEGIN
    -- When a new auth user is created, try to link to existing customer by email
    UPDATE public.customers
    SET 
      user_id = NEW.id,
      account_status = 'active',
      updated_at = now()
    WHERE email = NEW.email
      AND user_id IS NULL
      AND email IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Failed to link customer to auth user: %', SQLERRM;
  END;
  
  -- Always return NEW to allow the auth signup to succeed
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_customer_to_auth_user();
