/*
  # Add Stripe Configuration to Site Settings

  1. Updates to Existing Tables
    - Add `stripe_publishable_key` column to site_settings table
    - Add `stripe_secret_key` column to site_settings table
    - Add `stripe_webhook_secret` column to site_settings table
    - Add `stripe_enabled` column to site_settings table

  2. New Settings Entries
    - Insert default Stripe configuration settings

  3. Security Notes
    - Stripe keys should be encrypted at rest in production
    - Secret key should only be accessible server-side (edge functions)
    - RLS policies already in place from previous migration
*/

-- Add Stripe-specific columns to site_settings if needed
-- We'll store these as regular settings entries instead

-- Insert default Stripe settings
INSERT INTO site_settings (key, value, category) VALUES
  ('stripe_enabled', 'false', 'payment'),
  ('stripe_publishable_key', '""', 'payment'),
  ('stripe_secret_key', '""', 'payment'),
  ('stripe_webhook_secret', '""', 'payment')
ON CONFLICT (key) DO NOTHING;