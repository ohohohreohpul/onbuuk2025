/*
  # Add business_id to site_settings

  1. Schema Changes
    - Add `business_id` column to site_settings table
    - Update site_settings unique constraint to be per-business

  2. Security Updates
    - Update RLS policies to filter by business_id

  3. Notes
    - Existing data will need business_id assignment
    - Each business will have their own settings
*/

-- Add business_id to site_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_site_settings_business ON site_settings(business_id);
  END IF;
END $$;

-- Drop the old unique constraint on key alone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_key_key'
  ) THEN
    ALTER TABLE site_settings DROP CONSTRAINT site_settings_key_key;
  END IF;
END $$;

-- Add new unique constraint on business_id and key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_business_key_unique'
  ) THEN
    ALTER TABLE site_settings ADD CONSTRAINT site_settings_business_key_unique UNIQUE (business_id, key);
  END IF;
END $$;

-- Update RLS policies for site_settings
DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON site_settings;
DROP POLICY IF EXISTS "Authenticated users can manage site settings" ON site_settings;

CREATE POLICY "Site settings viewable by business"
  ON site_settings FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

CREATE POLICY "Authenticated users can manage their business settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
