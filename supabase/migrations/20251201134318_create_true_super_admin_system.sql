/*
  # Create True Super Admin System for Buuk Team
  
  1. New Tables
    - `super_admins` - Dedicated table for Buuk team members
      - `id` (uuid, primary key)
      - `email` (text, unique) 
      - `full_name` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `last_login` (timestamptz)
      - `notes` (text) - for internal notes about this admin
  
  2. Security
    - Enable RLS on super_admins table
    - Only super admins can query super_admins table
    - Super admins can view/edit ALL businesses
    - Super admins bypass all subscription restrictions
    - Add super_admin check functions for easy RLS usage
  
  3. Key Features
    - Super admins are NOT tied to any business
    - They can switch between businesses or view all
    - Complete system-wide access
    - Separate authentication flow
*/

-- Create super_admins table
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  notes TEXT
);

-- Enable RLS
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Create function to check if current user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current auth user's email exists in super_admins table
  RETURN EXISTS (
    SELECT 1 
    FROM super_admins 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND is_active = true
  );
END;
$$;

-- Create function to check if email is a super admin (for login)
CREATE OR REPLACE FUNCTION check_super_admin_by_email(p_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  is_active BOOLEAN,
  last_login TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.email,
    sa.full_name,
    sa.is_active,
    sa.last_login
  FROM super_admins sa
  WHERE sa.email = p_email AND sa.is_active = true;
END;
$$;

-- RLS Policy: Only super admins can access super_admins table
CREATE POLICY "Super admins can view super admin list"
  ON super_admins FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can update their own record"
  ON super_admins FOR UPDATE
  TO authenticated
  USING (is_super_admin() AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (is_super_admin() AND email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Update businesses RLS to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all businesses" ON businesses;
CREATE POLICY "Super admins can view all businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can update any business" ON businesses;
CREATE POLICY "Super admins can update any business"
  ON businesses FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Update admin_users RLS to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all admin users" ON admin_users;
CREATE POLICY "Super admins can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Update bookings RLS to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all bookings" ON bookings;
CREATE POLICY "Super admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can manage all bookings" ON bookings;
CREATE POLICY "Super admins can manage all bookings"
  ON bookings FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Update customers RLS to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all customers" ON customers;
CREATE POLICY "Super admins can view all customers"
  ON customers FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Update services RLS to allow super admin access  
DROP POLICY IF EXISTS "Super admins can view all services" ON services;
CREATE POLICY "Super admins can view all services"
  ON services FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Update specialists RLS to allow super admin access
DROP POLICY IF EXISTS "Super admins can view all specialists" ON specialists;
CREATE POLICY "Super admins can view all specialists"
  ON specialists FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email) WHERE is_active = true;

-- Add helpful comments
COMMENT ON TABLE super_admins IS 'Buuk team super administrators with system-wide access';
COMMENT ON FUNCTION is_super_admin() IS 'Returns true if current authenticated user is an active super admin';
COMMENT ON FUNCTION check_super_admin_by_email(TEXT) IS 'Checks if email belongs to an active super admin - used during login';
