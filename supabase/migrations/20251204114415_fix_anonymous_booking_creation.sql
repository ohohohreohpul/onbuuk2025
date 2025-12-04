/*
  # Fix Anonymous Booking Creation RLS Policy

  ## Problem
  Anonymous users (customers) cannot create bookings through the booking form because
  the RLS policies only allow authenticated admins to insert bookings.

  ## Changes
  1. Ensure anonymous/public users can INSERT into bookings table
  2. Keep existing admin and customer policies intact
  3. Add policy that allows public users to create bookings when business_id is provided

  ## Security
  - Anonymous users can ONLY insert bookings, not view, update, or delete
  - Business ID must be provided (NOT NULL check)
  - Viewing bookings still requires authentication or email match
*/

-- Drop existing public insert policy if it exists (to recreate with correct permissions)
DROP POLICY IF EXISTS "Users can create bookings for a business" ON bookings;
DROP POLICY IF EXISTS "Public can create bookings" ON bookings;
DROP POLICY IF EXISTS "Anonymous users can create bookings" ON bookings;

-- Create policy allowing anonymous users to create bookings
CREATE POLICY "Public users can create bookings"
  ON bookings
  FOR INSERT
  TO public
  WITH CHECK (business_id IS NOT NULL);
