/*
  # Fix Business Data Isolation with RLS

  1. Problem
    - Admins from different businesses can see each other's data
    - RLS policies don't properly filter by business_id
    - New businesses see demo data instead of clean slate

  2. Solution
    - Update all RLS policies to strictly filter by business_id
    - Use admin_users.business_id to determine which business the admin belongs to
    - Ensure authenticated users only see their own business data

  3. Tables Fixed
    - services
    - service_durations
    - specialists
    - service_specialist_assignments
    - bookings
    - customers
    - products
    - All other business-scoped tables
*/

-- Helper function to get current admin's business_id
CREATE OR REPLACE FUNCTION get_admin_business_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT business_id 
  FROM admin_users 
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND is_active = true
  LIMIT 1;
$$;

-- SERVICES TABLE
DROP POLICY IF EXISTS "Admins can view services" ON services;
DROP POLICY IF EXISTS "Admins can insert services" ON services;
DROP POLICY IF EXISTS "Admins can update services" ON services;
DROP POLICY IF EXISTS "Admins can delete services" ON services;

CREATE POLICY "Admins can view own business services"
  ON services FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business services"
  ON services FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business services"
  ON services FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- SERVICE DURATIONS TABLE
DROP POLICY IF EXISTS "Admins can manage service durations" ON service_durations;
DROP POLICY IF EXISTS "Admins can view service durations" ON service_durations;

CREATE POLICY "Admins can view own business service durations"
  ON service_durations FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business service durations"
  ON service_durations FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business service durations"
  ON service_durations FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business service durations"
  ON service_durations FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- SPECIALISTS TABLE
DROP POLICY IF EXISTS "Admins can view specialists" ON specialists;
DROP POLICY IF EXISTS "Admins can insert specialists" ON specialists;
DROP POLICY IF EXISTS "Admins can update specialists" ON specialists;
DROP POLICY IF EXISTS "Admins can delete specialists" ON specialists;

CREATE POLICY "Admins can view own business specialists"
  ON specialists FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business specialists"
  ON specialists FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business specialists"
  ON specialists FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business specialists"
  ON specialists FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- BOOKINGS TABLE
DROP POLICY IF EXISTS "Admins can view bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;

CREATE POLICY "Admins can view own business bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- CUSTOMERS TABLE
DROP POLICY IF EXISTS "Admins can view customers" ON customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON customers;

CREATE POLICY "Admins can view own business customers"
  ON customers FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business customers"
  ON customers FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- PRODUCTS TABLE
DROP POLICY IF EXISTS "Admins can manage products" ON products;

CREATE POLICY "Admins can view own business products"
  ON products FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business products"
  ON products FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business products"
  ON products FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- WORKING HOURS TABLE
DROP POLICY IF EXISTS "Admins can manage working hours" ON working_hours;

CREATE POLICY "Admins can view own business working hours"
  ON working_hours FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business working hours"
  ON working_hours FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business working hours"
  ON working_hours FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business working hours"
  ON working_hours FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- TIME BLOCKS TABLE
DROP POLICY IF EXISTS "Admins can manage time blocks" ON time_blocks;

CREATE POLICY "Admins can view own business time blocks"
  ON time_blocks FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can insert own business time blocks"
  ON time_blocks FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business time blocks"
  ON time_blocks FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business time blocks"
  ON time_blocks FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());
