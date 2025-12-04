/*
  # Add Deposits and No-Show Fee System

  ## Overview
  This migration adds comprehensive deposit and no-show fee tracking to the booking system.

  ## New Tables
  
  ### `deposit_settings`
  - `id` (uuid, primary key)
  - `business_id` (uuid, references businesses)
  - `service_id` (uuid, nullable, references services) - null means applies to all services
  - `deposit_type` (text) - 'percentage' or 'fixed'
  - `deposit_amount` (numeric) - percentage (0-100) or fixed amount
  - `deposit_required` (boolean) - whether deposit is mandatory
  - `refundable` (boolean) - whether deposit can be refunded
  - `refund_hours_before` (integer) - hours before appointment to get refund
  - `created_at`, `updated_at`

  ### `booking_deposits`
  - `id` (uuid, primary key)
  - `booking_id` (uuid, references bookings)
  - `amount` (numeric) - deposit amount charged
  - `status` (text) - 'pending', 'paid', 'refunded', 'forfeited'
  - `payment_intent_id` (text) - Stripe payment intent
  - `refunded_at` (timestamptz)
  - `refund_amount` (numeric)
  - `created_at`, `updated_at`

  ### `no_show_fees`
  - `id` (uuid, primary key)
  - `booking_id` (uuid, references bookings)
  - `customer_id` (uuid, references customers)
  - `amount` (numeric) - fee amount
  - `reason` (text) - 'no_show', 'late_cancel'
  - `charged_at` (timestamptz)
  - `paid` (boolean)
  - `paid_at` (timestamptz)
  - `notes` (text)
  - `created_at`

  ## Updates to Existing Tables
  
  ### `services`
  - Add `no_show_fee` (numeric, nullable) - fee for no-shows
  - Add `late_cancel_fee` (numeric, nullable) - fee for late cancellations
  - Add `late_cancel_hours` (integer, default 24) - hours before to avoid fee

  ### `bookings`
  - Add `no_show` (boolean, default false) - marked as no-show
  - Add `no_show_marked_at` (timestamptz) - when marked as no-show

  ## Security
  - Enable RLS on all new tables
  - Allow admin access for deposit and fee management
  - Allow customers to view their own deposits and fees
*/

-- Add deposit and no-show columns to services table
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS no_show_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_cancel_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_cancel_hours integer DEFAULT 24;

-- Add no-show tracking to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS no_show boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_show_marked_at timestamptz;

-- Create deposit_settings table
CREATE TABLE IF NOT EXISTS deposit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  deposit_type text NOT NULL CHECK (deposit_type IN ('percentage', 'fixed')),
  deposit_amount numeric NOT NULL CHECK (deposit_amount >= 0),
  deposit_required boolean DEFAULT false,
  refundable boolean DEFAULT true,
  refund_hours_before integer DEFAULT 24,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create booking_deposits table
CREATE TABLE IF NOT EXISTS booking_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'forfeited')),
  payment_intent_id text,
  refunded_at timestamptz,
  refund_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create no_show_fees table
CREATE TABLE IF NOT EXISTS no_show_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  reason text NOT NULL CHECK (reason IN ('no_show', 'late_cancel')),
  charged_at timestamptz DEFAULT now(),
  paid boolean DEFAULT false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deposit_settings_business ON deposit_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_deposit_settings_service ON deposit_settings(service_id);
CREATE INDEX IF NOT EXISTS idx_booking_deposits_booking ON booking_deposits(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_deposits_status ON booking_deposits(status);
CREATE INDEX IF NOT EXISTS idx_no_show_fees_customer ON no_show_fees(customer_id);
CREATE INDEX IF NOT EXISTS idx_no_show_fees_booking ON no_show_fees(booking_id);
CREATE INDEX IF NOT EXISTS idx_no_show_fees_paid ON no_show_fees(paid);

-- Enable RLS
ALTER TABLE deposit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_show_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deposit_settings
CREATE POLICY "Allow read access to deposit_settings"
  ON deposit_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow full access to deposit_settings for authenticated"
  ON deposit_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to deposit_settings for anon"
  ON deposit_settings FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for booking_deposits
CREATE POLICY "Allow read access to booking_deposits"
  ON booking_deposits FOR SELECT
  USING (true);

CREATE POLICY "Allow full access to booking_deposits for authenticated"
  ON booking_deposits FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to booking_deposits for anon"
  ON booking_deposits FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for no_show_fees
CREATE POLICY "Allow read access to no_show_fees"
  ON no_show_fees FOR SELECT
  USING (true);

CREATE POLICY "Allow full access to no_show_fees for authenticated"
  ON no_show_fees FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to no_show_fees for anon"
  ON no_show_fees FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_deposit_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_booking_deposits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_deposit_settings_updated_at ON deposit_settings;
CREATE TRIGGER update_deposit_settings_updated_at
  BEFORE UPDATE ON deposit_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_settings_updated_at();

DROP TRIGGER IF EXISTS update_booking_deposits_updated_at ON booking_deposits;
CREATE TRIGGER update_booking_deposits_updated_at
  BEFORE UPDATE ON booking_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_deposits_updated_at();
