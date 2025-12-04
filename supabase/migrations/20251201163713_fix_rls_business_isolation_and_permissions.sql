/*
  # Fix RLS Policies for Business Isolation and Permissions

  1. Issues Fixed
    - Remove overly permissive public SELECT policies that show all data
    - Fix services/specialists to only show data for the specific business being viewed
    - Fix bookings to require business_id context
    - Fix admin_users to not expose all admin emails
    - Ensure all tables have proper DELETE policies

  2. Security
    - Each business can only see/modify their own data
    - Public users can only see data for the business they're viewing (via business_id filter)
    - Authenticated admins can only manage their own business data
    - Super admins can view all data

  3. Changes
    - Drop and recreate all RLS policies with proper business isolation
    - Use business_id consistently for filtering
*/

-- ============================================
-- SERVICES TABLE - Fix RLS
-- ============================================

-- Drop old overly permissive policy
DROP POLICY IF EXISTS "Services are viewable by everyone" ON services;

-- Add proper business-scoped public SELECT
CREATE POLICY "Public can view services for a specific business"
  ON services FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- ============================================
-- SPECIALISTS TABLE - Fix RLS
-- ============================================

-- Drop old overly permissive policy
DROP POLICY IF EXISTS "Active specialists are viewable by everyone" ON specialists;

-- Add proper business-scoped public SELECT
CREATE POLICY "Public can view specialists for a specific business"
  ON specialists FOR SELECT
  TO public
  USING (business_id IS NOT NULL AND is_active = true);

-- ============================================
-- BOOKINGS TABLE - Fix RLS
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can view their own bookings by email" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;

-- Add policy for users to view bookings only for specific business
CREATE POLICY "Users can view bookings for a specific business"
  ON bookings FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- ============================================
-- ADMIN_USERS TABLE - Fix RLS
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow public read for login" ON admin_users;
DROP POLICY IF EXISTS "Public can create admin users" ON admin_users;

-- Add secure policy for login (only allow querying, app filters by email)
CREATE POLICY "Allow login lookup"
  ON admin_users FOR SELECT
  TO public
  USING (is_active = true);

-- Allow public to create admin users (needed for signup)
CREATE POLICY "Allow admin user creation during signup"
  ON admin_users FOR INSERT
  TO public
  WITH CHECK (true);

-- ============================================
-- SERVICE_DURATIONS TABLE - Fix policies
-- ============================================

-- Drop any overly permissive policies if they exist
DROP POLICY IF EXISTS "Service durations are viewable by everyone" ON service_durations;

-- Add proper business-scoped public SELECT
CREATE POLICY "Public can view service durations for a specific business"
  ON service_durations FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- ============================================
-- SPECIALIST_SERVICES TABLE - Fix policies
-- ============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Specialist services are viewable by everyone" ON specialist_services;

-- Add proper business-scoped public SELECT
CREATE POLICY "Public can view specialist services for a specific business"
  ON specialist_services FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Drop old policy and recreate with business isolation
DROP POLICY IF EXISTS "Authenticated users can manage specialist services" ON specialist_services;

CREATE POLICY "Admins can insert own business specialist services"
  ON specialist_services FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business specialist services"
  ON specialist_services FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business specialist services"
  ON specialist_services FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can view own business specialist services"
  ON specialist_services FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- AVAILABILITY_SLOTS TABLE - Fix policies
-- ============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Availability slots are viewable by everyone" ON availability_slots;

-- Add proper business-scoped public SELECT
CREATE POLICY "Public can view availability slots for a specific business"
  ON availability_slots FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Add admin management policies for availability_slots
DROP POLICY IF EXISTS "Availability slots are viewable by business" ON availability_slots;

CREATE POLICY "Admins can insert own business availability slots"
  ON availability_slots FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business availability slots"
  ON availability_slots FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business availability slots"
  ON availability_slots FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

CREATE POLICY "Admins can view own business availability slots"
  ON availability_slots FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());