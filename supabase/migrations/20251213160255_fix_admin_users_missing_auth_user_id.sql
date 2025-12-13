/*
  # Fix Missing auth_user_id in admin_users

  1. Issue
    - Many admin_users records have auth_user_id set to NULL
    - This breaks RLS policies that depend on auth_user_id = auth.uid()
    - Prevents admins from creating/updating their business data

  2. Solution
    - Sync auth_user_id from auth.users table based on matching email
    - Only update records where auth_user_id is currently NULL
    - Preserves existing auth_user_id values

  3. Impact
    - Fixes RLS policy enforcement for booking_form_customization
    - Allows admins to save images and settings properly
*/

-- Update admin_users to set auth_user_id from auth.users based on email match
UPDATE admin_users
SET auth_user_id = auth.users.id
FROM auth.users
WHERE admin_users.email = auth.users.email
  AND admin_users.auth_user_id IS NULL;
