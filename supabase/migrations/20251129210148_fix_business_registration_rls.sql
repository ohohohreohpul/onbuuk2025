/*
  # Fix Business Registration RLS Policies

  1. Updates to RLS Policies
    - Allow public INSERT to admin_users (needed during business registration)
    - Allow public INSERT to businesses (needed during registration)
    - Allow public INSERT to booking_form_colors (needed during registration)

  2. Security Notes
    - These policies only allow INSERT, not SELECT/UPDATE/DELETE
    - Business registration is a self-service flow
    - Once created, only authenticated admins can manage their data
*/

-- Allow public to create businesses during registration
DROP POLICY IF EXISTS "Public can create businesses" ON businesses;
CREATE POLICY "Public can create businesses"
  ON businesses FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow public to create admin users during registration
DROP POLICY IF EXISTS "Public can create admin users" ON admin_users;
CREATE POLICY "Public can create admin users"
  ON admin_users FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow public to create booking form colors during registration
DROP POLICY IF EXISTS "Public can create booking form colors" ON booking_form_colors;
CREATE POLICY "Public can create booking form colors"
  ON booking_form_colors FOR INSERT
  TO public
  WITH CHECK (true);
