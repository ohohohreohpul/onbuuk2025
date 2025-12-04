/*
  # Make Auth Trigger Completely Safe
  
  The auth.users trigger is causing signup failures because it tries to update
  the customers table, but this can fail in various scenarios:
  - No matching customer exists (business signup)
  - RLS policies
  - Permission issues
  
  Solution: Make the trigger truly fail-safe by ensuring it NEVER causes
  the auth signup to fail, regardless of what happens.
*/

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a completely safe version that catches ALL errors
CREATE OR REPLACE FUNCTION public.link_customer_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  -- Try to link customer, but catch ANY error and continue
  BEGIN
    -- When a new auth user is created, try to link to existing customer by email
    -- Only do this if there's actually a customer to link
    IF NEW.email IS NOT NULL THEN
      UPDATE public.customers
      SET 
        user_id = NEW.id,
        account_status = 'active',
        updated_at = now()
      WHERE email = NEW.email
        AND user_id IS NULL;
      
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      
      IF v_row_count > 0 THEN
        RAISE NOTICE 'Linked % customer(s) to auth user %', v_row_count, NEW.id;
      END IF;
    END IF;
  EXCEPTION 
    WHEN OTHERS THEN
      -- Log the error but absolutely do not fail the trigger
      -- This ensures auth signup always succeeds
      RAISE NOTICE 'Could not link customer to auth user %: %', NEW.id, SQLERRM;
  END;
  
  -- ALWAYS return NEW successfully
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_customer_to_auth_user();
