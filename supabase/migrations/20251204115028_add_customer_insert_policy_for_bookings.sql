/*
  # Add Customer INSERT Policy for Anonymous Booking Flow

  ## Problem
  Anonymous users (customers) cannot create bookings because the booking flow
  tries to create a customer record first, but there's no INSERT policy allowing
  anonymous users to insert into the customers table.

  ## Changes
  1. Add INSERT policy for customers table that allows anonymous users
  2. Require business_id to be provided for proper tenant isolation

  ## Security
  - Anonymous users can insert customer records when business_id is provided
  - This enables the public booking flow to work correctly
  - Business isolation is maintained through business_id requirement
*/

-- Drop policy if it exists, then create it
DROP POLICY IF EXISTS "Allow anon to insert customers" ON customers;

-- Add INSERT policy for anonymous users to create customers during booking
CREATE POLICY "Allow anon to insert customers"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (business_id IS NOT NULL);
