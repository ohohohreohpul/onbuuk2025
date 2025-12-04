/*
  # Update Demo Business with Generic Content

  1. Updates
    - Change demo business name to something generic
    - Update all site settings to be non-specific
    - Make content applicable to any service-based business
    - Remove specific industry references

  2. Purpose
    - Provide neutral starter content for new businesses
    - Allow businesses to customize for their specific needs
*/

-- Update demo business name
UPDATE businesses
SET name = 'My Booking Business'
WHERE subdomain = 'demo';

-- Clear existing site settings
DELETE FROM site_settings WHERE business_id = '00000000-0000-0000-0000-000000000001';

-- Insert generic site settings
INSERT INTO site_settings (business_id, key, value, category) VALUES
  ('00000000-0000-0000-0000-000000000001', 'site_title', '"Welcome to Our Studio"', 'branding'),
  ('00000000-0000-0000-0000-000000000001', 'site_description', '"Book your appointment with us today"', 'branding'),
  ('00000000-0000-0000-0000-000000000001', 'hero_image', '"https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg"', 'branding'),
  ('00000000-0000-0000-0000-000000000001', 'welcome_title', '"Book Your Appointment"', 'content'),
  ('00000000-0000-0000-0000-000000000001', 'welcome_description', '"Select from our available services and choose a time that works best for you. We look forward to serving you!"', 'content'),
  ('00000000-0000-0000-0000-000000000001', 'booking_policy', '"Cancellations must be made at least 24 hours in advance. Please arrive 10 minutes early for your appointment."', 'content'),
  ('00000000-0000-0000-0000-000000000001', 'contact_email', '"info@example.com"', 'contact'),
  ('00000000-0000-0000-0000-000000000001', 'contact_phone', '"+1 (555) 123-4567"', 'contact'),
  ('00000000-0000-0000-0000-000000000001', 'stripe_enabled', '"false"', 'payment');
