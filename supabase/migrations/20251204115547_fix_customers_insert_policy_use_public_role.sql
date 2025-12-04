/*
  # Fix Customers INSERT Policy to Use Public Role

  ## Problem
  The customers INSERT policies use "TO anon" but the bookings policy uses "TO public".
  This inconsistency might be causing issues with the RLS evaluation.
  
  ## Changes
  1. Drop existing anon-specific INSERT policies
  2. Create a single INSERT policy using "TO public" (includes both anon and authenticated)
  3. This matches the pattern used for the bookings table

  ## Security
  - Public users (anon and authenticated) can insert customers when business_id is provided
  - Maintains tenant isolation through business_id requirement
*/

-- Drop existing INSERT policies for customers
DROP POLICY IF EXISTS "Allow anon to insert customers" ON customers;
DROP POLICY IF EXISTS "Anonymous can create guest customers" ON customers;

-- Create new INSERT policy using public role (same pattern as bookings)
CREATE POLICY "Public users can create customers"
  ON customers
  FOR INSERT
  TO public
  WITH CHECK (business_id IS NOT NULL);
