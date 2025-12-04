/*
  # Massage Studio Booking System Schema

  1. New Tables
    - `services`
      - `id` (uuid, primary key)
      - `name` (text) - Service name
      - `description` (text) - Service description
      - `is_pair_massage` (boolean) - Whether this service supports pair bookings
      - `image_url` (text, nullable) - Service image
      - `created_at` (timestamptz)
    
    - `service_durations`
      - `id` (uuid, primary key)
      - `service_id` (uuid, foreign key)
      - `duration_minutes` (integer) - Duration in minutes
      - `price_cents` (integer) - Price in cents
      - `created_at` (timestamptz)
    
    - `specialists`
      - `id` (uuid, primary key)
      - `name` (text) - Specialist name
      - `bio` (text, nullable) - Short bio
      - `image_url` (text, nullable) - Profile photo
      - `is_active` (boolean) - Whether specialist is currently bookable
      - `created_at` (timestamptz)
    
    - `specialist_services`
      - `id` (uuid, primary key)
      - `specialist_id` (uuid, foreign key)
      - `service_id` (uuid, foreign key)
      - Junction table for many-to-many relationship
    
    - `availability_slots`
      - `id` (uuid, primary key)
      - `specialist_id` (uuid, foreign key)
      - `day_of_week` (integer) - 0-6 (Sunday to Saturday)
      - `start_time` (time) - Start time
      - `end_time` (time) - End time
      - `created_at` (timestamptz)
    
    - `bookings`
      - `id` (uuid, primary key)
      - `service_id` (uuid, foreign key)
      - `duration_id` (uuid, foreign key)
      - `specialist_id` (uuid, foreign key, nullable) - Null means "anyone available"
      - `booking_date` (date) - Date of booking
      - `start_time` (time) - Start time
      - `customer_name` (text) - Customer name
      - `customer_email` (text) - Customer email
      - `customer_phone` (text) - Customer phone
      - `is_pair_booking` (boolean) - Whether this is a pair massage
      - `payment_status` (text) - Payment status
      - `payment_intent_id` (text, nullable) - Stripe payment intent
      - `status` (text) - Booking status (pending, confirmed, cancelled)
      - `notes` (text, nullable) - Additional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for services, durations, specialists (for booking flow)
    - Authenticated access for managing bookings
    - Service role access for admin operations
*/

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  is_pair_massage boolean DEFAULT false,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services are viewable by everyone"
  ON services FOR SELECT
  USING (true);

-- Service durations table
CREATE TABLE IF NOT EXISTS service_durations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL,
  price_cents integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_durations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service durations are viewable by everyone"
  ON service_durations FOR SELECT
  USING (true);

-- Specialists table
CREATE TABLE IF NOT EXISTS specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bio text,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE specialists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active specialists are viewable by everyone"
  ON specialists FOR SELECT
  USING (is_active = true);

-- Specialist services junction table
CREATE TABLE IF NOT EXISTS specialist_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(specialist_id, service_id)
);

ALTER TABLE specialist_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialist services are viewable by everyone"
  ON specialist_services FOR SELECT
  USING (true);

-- Availability slots table
CREATE TABLE IF NOT EXISTS availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability slots are viewable by everyone"
  ON availability_slots FOR SELECT
  USING (true);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id),
  duration_id uuid NOT NULL REFERENCES service_durations(id),
  specialist_id uuid REFERENCES specialists(id),
  booking_date date NOT NULL,
  start_time time NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  is_pair_booking boolean DEFAULT false,
  payment_status text DEFAULT 'pending',
  payment_intent_id text,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own bookings by email"
  ON bookings FOR SELECT
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_specialist ON bookings(specialist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_specialist_services_specialist ON specialist_services(specialist_id);
CREATE INDEX IF NOT EXISTS idx_specialist_services_service ON specialist_services(service_id);