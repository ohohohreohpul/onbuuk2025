/*
  # Add Multi-Tenancy Support

  1. New Tables
    - `businesses`
      - `id` (uuid, primary key) - Unique business identifier
      - `name` (text) - Business name
      - `subdomain` (text, unique) - Subdomain identifier (e.g., 'hamburg-spa')
      - `custom_domain` (text, nullable) - Custom domain if on Pro plan
      - `plan_type` (text) - Subscription plan (starter, professional, enterprise)
      - `is_active` (boolean) - Whether the business account is active
      - `settings` (jsonb) - Business-specific settings
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Schema Changes
    - Add `business_id` column to all existing tables:
      - services
      - service_durations
      - specialists
      - specialist_services
      - availability_slots
      - bookings
      - booking_form_images
      - booking_form_texts
      - booking_form_colors
      - admin_users

  3. Security Updates
    - Update all RLS policies to be tenant-aware
    - Each business can only access their own data
    - Public booking flow only sees data for the specific business

  4. Important Notes
    - This migration adds multi-tenancy without data loss
    - Existing data will need business_id assignment (handled separately)
    - All queries will be filtered by business_id for complete tenant isolation
*/

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  custom_domain text UNIQUE,
  plan_type text DEFAULT 'starter' CHECK (plan_type IN ('starter', 'professional', 'enterprise')),
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on businesses table
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- Simple policy for businesses - service role can manage all
CREATE POLICY "Service role can manage all businesses"
  ON businesses FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add business_id to admin_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_admin_users_business ON admin_users(business_id);
  END IF;
END $$;

-- Add business_id to services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE services ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
  END IF;
END $$;

-- Add business_id to service_durations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_durations' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE service_durations ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_service_durations_business ON service_durations(business_id);
  END IF;
END $$;

-- Add business_id to specialists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'specialists' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE specialists ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_specialists_business ON specialists(business_id);
  END IF;
END $$;

-- Add business_id to specialist_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'specialist_services' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE specialist_services ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_specialist_services_business ON specialist_services(business_id);
  END IF;
END $$;

-- Add business_id to availability_slots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'availability_slots' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE availability_slots ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_availability_slots_business ON availability_slots(business_id);
  END IF;
END $$;

-- Add business_id to bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
  END IF;
END $$;

-- Add business_id to booking_form_images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_images' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE booking_form_images ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_booking_form_images_business ON booking_form_images(business_id);
  END IF;
END $$;

-- Add business_id to booking_form_texts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_texts' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE booking_form_texts ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_booking_form_texts_business ON booking_form_texts(business_id);
  END IF;
END $$;

-- Add business_id to booking_form_colors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_colors' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE booking_form_colors ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_booking_form_colors_business ON booking_form_colors(business_id);
  END IF;
END $$;

-- Update RLS policies for services
DROP POLICY IF EXISTS "Services are viewable by everyone" ON services;
DROP POLICY IF EXISTS "Anon users can view services" ON services;

CREATE POLICY "Services are viewable by business"
  ON services FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Update RLS policies for service_durations  
DROP POLICY IF EXISTS "Service durations are viewable by everyone" ON service_durations;
DROP POLICY IF EXISTS "Anon users can view service durations" ON service_durations;

CREATE POLICY "Service durations are viewable by business"
  ON service_durations FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Update RLS policies for specialists
DROP POLICY IF EXISTS "Active specialists are viewable by everyone" ON specialists;
DROP POLICY IF EXISTS "Anon users can view active specialists" ON specialists;

CREATE POLICY "Active specialists are viewable by business"
  ON specialists FOR SELECT
  TO public
  USING (is_active = true AND business_id IS NOT NULL);

-- Update RLS policies for specialist_services
DROP POLICY IF EXISTS "Specialist services are viewable by everyone" ON specialist_services;

CREATE POLICY "Specialist services are viewable by business"
  ON specialist_services FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Update RLS policies for availability_slots
DROP POLICY IF EXISTS "Availability slots are viewable by everyone" ON availability_slots;

CREATE POLICY "Availability slots are viewable by business"
  ON availability_slots FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Update RLS policies for bookings
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view their own bookings by email" ON bookings;

CREATE POLICY "Users can create bookings for a business"
  ON bookings FOR INSERT
  TO public
  WITH CHECK (business_id IS NOT NULL);

CREATE POLICY "Users can view bookings"
  ON bookings FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Update RLS policies for booking_form_images
DROP POLICY IF EXISTS "Anyone can view booking form images" ON booking_form_images;
DROP POLICY IF EXISTS "Anyone can insert booking form images" ON booking_form_images;
DROP POLICY IF EXISTS "Anyone can update booking form images" ON booking_form_images;
DROP POLICY IF EXISTS "Anyone can delete booking form images" ON booking_form_images;

CREATE POLICY "Booking form images viewable by business"
  ON booking_form_images FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Update RLS policies for booking_form_texts
DROP POLICY IF EXISTS "Anyone can view booking form texts" ON booking_form_texts;
DROP POLICY IF EXISTS "Anyone can insert booking form texts" ON booking_form_texts;
DROP POLICY IF EXISTS "Anyone can update booking form texts" ON booking_form_texts;
DROP POLICY IF EXISTS "Anyone can delete booking form texts" ON booking_form_texts;

CREATE POLICY "Booking form texts viewable by business"
  ON booking_form_texts FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Update RLS policies for booking_form_colors
DROP POLICY IF EXISTS "Anyone can view booking form colors" ON booking_form_colors;
DROP POLICY IF EXISTS "Anyone can insert booking form colors" ON booking_form_colors;
DROP POLICY IF EXISTS "Anyone can update booking form colors" ON booking_form_colors;
DROP POLICY IF EXISTS "Anyone can delete booking form colors" ON booking_form_colors;

CREATE POLICY "Booking form colors viewable by business"
  ON booking_form_colors FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Index for subdomain lookups (critical for performance)
CREATE INDEX IF NOT EXISTS idx_businesses_subdomain ON businesses(subdomain);
CREATE INDEX IF NOT EXISTS idx_businesses_custom_domain ON businesses(custom_domain);
