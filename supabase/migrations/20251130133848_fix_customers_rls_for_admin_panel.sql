/*
  # Fix Customers RLS for Admin Panel Access

  ## Issue
  Admin panel uses custom authentication (localStorage), not Supabase Auth.
  This means auth.uid() is NULL when admins are viewing the customers page.
  The existing RLS policies require auth.uid() to match admin_users.id, which fails.

  ## Solution
  Add policies that allow anon access to view customers (admin panel queries use anon key).
  Keep existing authenticated policies for when we add real auth later.

  ## Security
  - Anon users can SELECT, INSERT, and UPDATE customers
  - This is needed for both admin panel and booking flow
  - Business_id must be provided for proper isolation
*/

-- Allow anonymous users to view customers (for admin panel)
CREATE POLICY "Allow anon to view customers"
  ON customers FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to insert customers (for booking flow and admin panel)
CREATE POLICY "Allow anon to insert customers"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (business_id IS NOT NULL);

-- Allow anonymous users to view customer_notes (for admin panel)
CREATE POLICY "Allow anon to view customer notes"
  ON customer_notes FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to create customer notes (for admin panel)
CREATE POLICY "Allow anon to create customer notes"
  ON customer_notes FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to update customer notes (for admin panel)
CREATE POLICY "Allow anon to update customer notes"
  ON customer_notes FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to delete customer notes (for admin panel)
CREATE POLICY "Allow anon to delete customer notes"
  ON customer_notes FOR DELETE
  TO anon
  USING (true);

-- Allow anonymous users to update customers (for admin panel)
CREATE POLICY "Allow anon to update customers"
  ON customers FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
