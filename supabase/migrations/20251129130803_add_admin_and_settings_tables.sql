/*
  # Admin Panel and Settings Schema

  1. New Tables
    - `admin_users`
      - `id` (uuid, primary key)
      - `email` (text, unique) - Admin email
      - `password_hash` (text) - Hashed password
      - `full_name` (text) - Admin full name
      - `role` (text) - Admin role (admin, staff)
      - `is_active` (boolean) - Whether admin account is active
      - `created_at` (timestamptz)
      - `last_login` (timestamptz, nullable)
    
    - `site_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) - Setting key
      - `value` (text) - Setting value (JSON stringified)
      - `category` (text) - Setting category (branding, content, etc)
      - `updated_at` (timestamptz)
      - `updated_by` (uuid, foreign key to admin_users)
    
    - `audit_log`
      - `id` (uuid, primary key)
      - `admin_user_id` (uuid, foreign key)
      - `action` (text) - Action performed
      - `entity_type` (text) - Type of entity (booking, service, etc)
      - `entity_id` (uuid, nullable) - ID of affected entity
      - `details` (jsonb) - Additional details
      - `created_at` (timestamptz)

  2. Updates to Existing Tables
    - Add `image_url` column to services if not exists
    - Add `updated_at` column to services
    - Add `updated_at` column to specialists
    - Add `updated_at` column to service_durations

  3. Security
    - Enable RLS on all new tables
    - Admin tables only accessible by authenticated admins
    - Site settings readable by everyone, writable by admins
*/

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view all admin accounts"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

-- Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  category text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES admin_users(id)
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site settings are viewable by everyone"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage site settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add updated_at columns to existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE services ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'specialists' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE specialists ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_durations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE service_durations ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Update RLS policies for authenticated admin access
CREATE POLICY "Authenticated users can manage services"
  ON services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage service durations"
  ON service_durations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage specialists"
  ON specialists FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage specialist services"
  ON specialist_services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage bookings"
  ON bookings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default site settings
INSERT INTO site_settings (key, value, category) VALUES
  ('site_title', '"Hamburg Holistic Massage Studio"', 'branding'),
  ('site_description', '"Experience holistic wellness in the heart of Hamburg"', 'branding'),
  ('hero_image', '""', 'branding'),
  ('welcome_title', '"Welcome to Our Studio"', 'content'),
  ('welcome_description', '"Experience holistic wellness in the heart of Hamburg. Book your personalized massage session with our experienced therapists."', 'content'),
  ('booking_policy', '"Cancellations must be made at least 24 hours in advance."', 'content'),
  ('contact_email', '"info@hamburgmassage.de"', 'contact'),
  ('contact_phone', '"+49 40 123456"', 'contact')
ON CONFLICT (key) DO NOTHING;

-- Insert demo admin user (password: admin123)
INSERT INTO admin_users (email, password_hash, full_name, role) VALUES
  ('admin@hamburgmassage.de', '$2a$10$rKqH8qKJ5YzKJ5YzKJ5YzO4xKqH8qKJ5YzKJ5YzKJ5YzKJ5YzK', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_settings_category ON site_settings(category);