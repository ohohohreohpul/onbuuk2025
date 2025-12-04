/*
  # Create Default Demo Business

  1. Default Business
    - Creates a "demo" business for development
    - Subdomain: "demo"
    - Pre-configured for immediate use

  2. Demo Admin Account
    - Email: admin@demo.com
    - Password: admin123
    - Linked to demo business

  3. Default Data Migration
    - Assigns all existing unassigned data to demo business
    - Updates services, specialists, bookings, etc.

  4. Purpose
    - Allows development without registration
    - Localhost will automatically use "demo" subdomain
    - Existing data won't break
*/

-- Create demo business
INSERT INTO businesses (id, name, subdomain, plan_type, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Business',
  'demo',
  'professional',
  true
)
ON CONFLICT (subdomain) DO NOTHING;

-- Update existing admin users to belong to demo business
UPDATE admin_users 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

-- Update all existing data to belong to demo business
UPDATE services 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE service_durations 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE specialists 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE specialist_services 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE availability_slots 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE bookings 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE booking_form_images 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE booking_form_texts 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE booking_form_colors 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

UPDATE site_settings 
SET business_id = '00000000-0000-0000-0000-000000000001'
WHERE business_id IS NULL;

-- Insert default booking form colors for demo business if they don't exist
INSERT INTO booking_form_colors (business_id, color_key, color_value) VALUES
  ('00000000-0000-0000-0000-000000000001', 'primary', '#1c1917'),
  ('00000000-0000-0000-0000-000000000001', 'primary_hover', '#44403c'),
  ('00000000-0000-0000-0000-000000000001', 'secondary', '#78716c'),
  ('00000000-0000-0000-0000-000000000001', 'text_primary', '#1c1917'),
  ('00000000-0000-0000-0000-000000000001', 'text_secondary', '#57534e'),
  ('00000000-0000-0000-0000-000000000001', 'background', '#ffffff'),
  ('00000000-0000-0000-0000-000000000001', 'background_secondary', '#fafaf9'),
  ('00000000-0000-0000-0000-000000000001', 'border', '#e7e5e4'),
  ('00000000-0000-0000-0000-000000000001', 'accent', '#1c1917')
ON CONFLICT DO NOTHING;
