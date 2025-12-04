/*
  # Fix admin_users RLS for tenant lookup

  1. Problem
    - TenantProvider needs to look up admin_users by email to find business_id
    - Current RLS policies may block this lookup

  2. Solution
    - Allow authenticated users to read their own admin_users record
*/

DROP POLICY IF EXISTS "Users can read own admin record" ON admin_users;

CREATE POLICY "Users can read own admin record"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
