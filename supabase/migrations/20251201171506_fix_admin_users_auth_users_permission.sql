/*
  # Fix Admin Users RLS Policy - Remove auth.users Permission Error

  1. Issue
    - Policy "Users can read own admin record" queries auth.users table
    - This causes "permission denied for table users" error
    - The policy should use user_id instead of email lookup

  2. Solution
    - Drop the problematic policy that queries auth.users
    - Create a simpler policy using user_id = auth.uid()

  3. Security
    - Users can still only read their own admin record
    - No loss of security, just simpler and works correctly
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can read own admin record" ON admin_users;

-- Create a simpler policy that doesn't query auth.users
CREATE POLICY "Users can read own admin record by user_id"
ON admin_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
