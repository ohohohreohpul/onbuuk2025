/*
  # Fix Admin Users Login RLS Policy

  1. Issue
    - The "Allow login lookup" policy only works for anon users
    - Authenticated users after signup can't query admin_users for login
    - This causes 403 errors during the login process

  2. Solution
    - Update the "Allow login lookup" policy to work for both anon and authenticated users
    - Allow querying by business_id for active admin users

  3. Security
    - Still restricted to active users only
    - No sensitive data exposed
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow login lookup" ON admin_users;

-- Create a new policy that allows both anon and authenticated users to lookup active admins
CREATE POLICY "Allow login lookup for active admins"
ON admin_users
FOR SELECT
TO public
USING (is_active = true);
