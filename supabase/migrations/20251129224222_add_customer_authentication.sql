/*
  # Add Customer Authentication System

  1. Changes to Existing Tables
    - `customers`
      - Add `user_id` (uuid, references auth.users, nullable)
      - Add `account_status` (text: 'guest', 'active', 'pending_verification')
      - Add `password_reset_token` (text, nullable)
      - Add `password_reset_expires` (timestamptz, nullable)

  2. Security Updates
    - Update RLS policies for customer self-service
    - Customers can view/update their own profile
    - Admins can view all customers for their business
    - Anonymous users can still create guest bookings

  3. Important Notes
    - Uses Supabase's built-in auth.users for authentication
    - Guest customers (no user_id) are created when booking without account
    - Customers can claim their profile by creating account with same email
    - After first booking, send "Create your account" email
*/

-- Add authentication columns to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE customers ADD COLUMN account_status text DEFAULT 'guest' CHECK (account_status IN ('guest', 'active', 'pending_verification'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'password_reset_token'
  ) THEN
    ALTER TABLE customers ADD COLUMN password_reset_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'password_reset_expires'
  ) THEN
    ALTER TABLE customers ADD COLUMN password_reset_expires timestamptz;
  END IF;
END $$;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can insert customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers" ON customers;
DROP POLICY IF EXISTS "Users can delete customers" ON customers;

-- New RLS Policies for customers table

-- Anonymous users can insert guest customers (during booking)
CREATE POLICY "Anonymous can create guest customers"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Authenticated customers can view their own profile
CREATE POLICY "Customers can view own profile"
  ON customers FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = customers.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- Authenticated customers can update their own profile
CREATE POLICY "Customers can update own profile"
  ON customers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all customers for their business
CREATE POLICY "Admins can view business customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = customers.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- Admins can insert customers
CREATE POLICY "Admins can create customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = customers.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- Admins can update customers
CREATE POLICY "Admins can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = customers.business_id
      AND admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = customers.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- Admins can delete customers
CREATE POLICY "Admins can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = customers.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- Update customer_notes RLS (only admins and customers themselves)
DROP POLICY IF EXISTS "Users can view customer notes" ON customer_notes;
DROP POLICY IF EXISTS "Users can insert customer notes" ON customer_notes;
DROP POLICY IF EXISTS "Users can update customer notes" ON customer_notes;
DROP POLICY IF EXISTS "Users can delete customer notes" ON customer_notes;

-- Only admins can manage customer notes (private internal notes)
CREATE POLICY "Admins can view customer notes"
  ON customer_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = customer_notes.customer_id
      AND a.id = auth.uid()
    )
  );

CREATE POLICY "Admins can create customer notes"
  ON customer_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = customer_notes.customer_id
      AND a.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update customer notes"
  ON customer_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = customer_notes.customer_id
      AND a.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = customer_notes.customer_id
      AND a.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete customer notes"
  ON customer_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = customer_notes.customer_id
      AND a.id = auth.uid()
    )
  );

-- Function to link customer profile to auth user on signup
CREATE OR REPLACE FUNCTION link_customer_to_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new auth user is created, try to link to existing customer by email
  UPDATE customers
  SET 
    user_id = NEW.id,
    account_status = 'active',
    updated_at = now()
  WHERE email = NEW.email
  AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if user creates account, link to customer)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_customer_to_auth_user();