-- Fix currency settings persistence issue
-- This migration ensures currency settings use the key/value pattern consistently

-- Migrate any existing currency values from the legacy column to key/value pattern
INSERT INTO site_settings (business_id, key, value, category, updated_at)
SELECT DISTINCT 
  business_id, 
  'currency' as key, 
  currency as value, 
  'general' as category,
  NOW() as updated_at
FROM site_settings 
WHERE currency IS NOT NULL 
  AND currency != ''
  AND business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM site_settings s2 
    WHERE s2.business_id = site_settings.business_id 
    AND s2.key = 'currency'
  )
ON CONFLICT (business_id, key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- Also check for any businesses that have currency in the businesses table
-- and migrate those as well (if that column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'businesses' AND column_name = 'currency'
  ) THEN
    INSERT INTO site_settings (business_id, key, value, category, updated_at)
    SELECT 
      id as business_id, 
      'currency' as key, 
      currency as value, 
      'general' as category,
      NOW() as updated_at
    FROM businesses 
    WHERE currency IS NOT NULL 
      AND currency != ''
      AND NOT EXISTS (
        SELECT 1 FROM site_settings s 
        WHERE s.business_id = businesses.id 
        AND s.key = 'currency'
      )
    ON CONFLICT (business_id, key) DO NOTHING;
  END IF;
END $$;

-- Verify the migration
SELECT 
  business_id, 
  key, 
  value as currency_value,
  updated_at
FROM site_settings 
WHERE key = 'currency'
ORDER BY updated_at DESC;
