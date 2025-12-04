/*
  # Fix Admin Users Login Access

  1. Changes
    - Drop the restrictive authenticated-only policy on admin_users
    - Add a new policy that allows public SELECT access for login
    - This allows the login form to query admin_users to verify credentials
  
  2. Security Notes
    - Only SELECT is allowed publicly
    - Password hashes are stored but verification happens client-side for demo
    - In production, this should use proper auth with server-side verification
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Admin users can view all admin accounts" ON admin_users;

-- Allow public read access for login verification
CREATE POLICY "Allow public read for login"
  ON admin_users FOR SELECT
  USING (true);
