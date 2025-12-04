/*
  # Add RLS for Business Updates

  1. Security Updates
    - Allow authenticated admins to update their own business settings
    - Admins can only modify their own business (not other businesses)
    - Public can still read businesses for tenant detection
    - Public can still insert businesses for registration

  2. Purpose
    - Enables admins to update subdomain and custom domain settings
    - Maintains security by restricting updates to business owners only
*/

-- Allow admins to update their own business
DROP POLICY IF EXISTS "Admins can update their own business" ON businesses;
CREATE POLICY "Admins can update their own business"
  ON businesses FOR UPDATE
  TO public
  USING (
    id IN (
      SELECT business_id FROM admin_users
      WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  )
  WITH CHECK (
    id IN (
      SELECT business_id FROM admin_users
      WHERE email = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

-- Allow public to read businesses for tenant detection
DROP POLICY IF EXISTS "Public can read businesses" ON businesses;
CREATE POLICY "Public can read businesses"
  ON businesses FOR SELECT
  TO public
  USING (is_active = true);
