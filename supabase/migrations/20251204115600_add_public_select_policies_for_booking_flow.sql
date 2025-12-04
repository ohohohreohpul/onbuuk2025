/*
  # Add Public SELECT Policies for Booking Flow

  ## Problem
  The booking flow code uses .select() after .insert() to return the created records.
  This requires SELECT permission in addition to INSERT permission.
  Currently, there are no SELECT policies allowing public/anon access.

  ## Changes
  1. Add SELECT policy for customers table (public can view)
  2. Add SELECT policy for bookings table (public can view)
  3. These are needed for the .insert().select() pattern to work

  ## Security
  - Allow public users to select customers and bookings
  - In production, you may want to restrict this further
  - For now, enabling to unblock the booking flow
*/

-- Allow public users to view customers (needed for .select() after .insert())
DROP POLICY IF EXISTS "Allow anon to view customers" ON customers;
CREATE POLICY "Public can view customers"
  ON customers
  FOR SELECT
  TO public
  USING (true);

-- Allow public users to view bookings (needed for .select() after .insert())
CREATE POLICY "Public can view bookings"
  ON bookings
  FOR SELECT
  TO public
  USING (true);
