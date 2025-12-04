/*
  # Fix Critical Bookings RLS Security Vulnerability

  ## Problem
  The policy "Users can view bookings for a specific business" allows ANY user (including anonymous)
  to view ALL bookings from ALL businesses. This is a critical security vulnerability.

  ## Changes
  1. DROP the insecure public SELECT policy on bookings
  2. Ensure only authenticated admins can view their own business bookings
  3. Ensure only authenticated customers can view their own bookings

  ## Security
  After this migration:
  - Anonymous users CANNOT view any bookings
  - Authenticated admins can ONLY view bookings from their business (via get_admin_business_id())
  - Authenticated customers can ONLY view their own bookings
  - Super admins can view all bookings
*/

-- Drop the insecure policy that allows public to view all bookings
DROP POLICY IF EXISTS "Users can view bookings for a specific business" ON bookings;

-- The correct policies are already in place:
-- 1. "Admins can view own business bookings" - uses get_admin_business_id()
-- 2. "Customers can view own bookings" - checks customer_email matches auth.uid()
-- 3. "Super admins can view all bookings" - checks is_super_admin()
