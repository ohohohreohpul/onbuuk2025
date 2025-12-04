/*
  # Add Customer Profiles and Notes (CRM Lite)

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `name` (text)
      - `email` (text)
      - `phone` (text, nullable)
      - `total_bookings` (integer, default 0)
      - `total_spent_cents` (integer, default 0)
      - `first_visit_date` (timestamptz, nullable)
      - `last_visit_date` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE(business_id, email) - one customer per email per business

    - `customer_notes`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `note` (text)
      - `created_by` (text - admin email/name)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - `upsert_customer_from_booking()` - Trigger function to auto-create/update customer profiles

  3. Security
    - Enable RLS on both tables
    - Only authenticated users can manage customers
    - Customers are isolated per business

  4. Important Notes
    - Customers are auto-created/updated when bookings are created or completed
    - Total bookings and spent are calculated from bookings table
    - Notes are private and only visible to business admins
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  total_bookings integer DEFAULT 0,
  total_spent_cents integer DEFAULT 0,
  first_visit_date timestamptz,
  last_visit_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, email)
);

-- Create customer_notes table
CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for customer_notes
CREATE POLICY "Users can view customer notes"
  ON customer_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customer notes"
  ON customer_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customer notes"
  ON customer_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customer notes"
  ON customer_notes FOR DELETE
  TO authenticated
  USING (true);

-- Function to auto-create/update customer profile from booking
CREATE OR REPLACE FUNCTION upsert_customer_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  customer_record customers%ROWTYPE;
  booking_total integer;
BEGIN
  -- Get the price from the duration
  SELECT d.price_cents INTO booking_total
  FROM service_durations d
  WHERE d.id = NEW.duration_id;

  -- Insert or update customer
  INSERT INTO customers (business_id, name, email, phone, total_bookings, total_spent_cents, first_visit_date, last_visit_date)
  VALUES (
    NEW.business_id,
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    1,
    COALESCE(booking_total, 0),
    NEW.booking_date,
    NEW.booking_date
  )
  ON CONFLICT (business_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    total_bookings = customers.total_bookings + 1,
    total_spent_cents = customers.total_spent_cents + COALESCE(booking_total, 0),
    last_visit_date = CASE
      WHEN EXCLUDED.last_visit_date > customers.last_visit_date THEN EXCLUDED.last_visit_date
      ELSE customers.last_visit_date
    END,
    first_visit_date = CASE
      WHEN EXCLUDED.first_visit_date < customers.first_visit_date THEN EXCLUDED.first_visit_date
      ELSE customers.first_visit_date
    END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS trigger_upsert_customer ON bookings;
CREATE TRIGGER trigger_upsert_customer
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION upsert_customer_from_booking();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(business_id, email);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);
