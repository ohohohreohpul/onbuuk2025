/*
  # Add Logo Support to Businesses

  1. Schema Changes
    - Add `logo_url` column to businesses table
    - Allows businesses to upload and display their logo

  2. Purpose
    - Enable custom branding in admin panel
    - Replace generic text with business logo
*/

-- Add logo_url column to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE businesses ADD COLUMN logo_url text;
  END IF;
END $$;
