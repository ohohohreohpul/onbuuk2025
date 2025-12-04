/*
  # Add Customer Access to Their Bookings

  1. Security Updates
    - Allow customers to view their own bookings
    - Allow customers to cancel their own bookings
    - Maintain admin access to all bookings

  2. Important Notes
    - Customers can see bookings linked to their email or user_id
    - Admins retain full access to all business bookings
    - Anonymous users can still create bookings
*/

-- Add policies for customers to view their own bookings
CREATE POLICY "Customers can view own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    -- Customer can see bookings with their email
    customer_email = (SELECT email FROM customers WHERE user_id = auth.uid() LIMIT 1)
    OR
    -- Or admin can see all bookings for their business
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = bookings.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- Allow customers to update their own bookings (for cancellation)
CREATE POLICY "Customers can update own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    -- Customer can update bookings with their email
    customer_email = (SELECT email FROM customers WHERE user_id = auth.uid() LIMIT 1)
    OR
    -- Or admin can update all bookings for their business
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = bookings.business_id
      AND admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    -- Customer can update bookings with their email
    customer_email = (SELECT email FROM customers WHERE user_id = auth.uid() LIMIT 1)
    OR
    -- Or admin can update all bookings for their business
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = bookings.business_id
      AND admin_users.id = auth.uid()
    )
  );