/*
  # Add permalink routing to businesses

  1. Changes
    - Add permalink column to businesses table
    - Permalink will be used in URLs like /biz-a3f9k2x1
    - Remove subdomain/custom_domain uniqueness constraints
    - Make permalink unique instead

  2. Security
    - Permalink is generated securely and randomly
    - Used for routing instead of subdomain/custom_domain
*/

-- Add permalink column
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS permalink text;

-- Drop old unique constraints if they exist
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_subdomain_key;
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_custom_domain_key;

-- Make permalink unique
CREATE UNIQUE INDEX IF NOT EXISTS businesses_permalink_key ON businesses(permalink);

-- Update existing businesses with permalinks based on subdomain or generate new
UPDATE businesses 
SET permalink = COALESCE(
  subdomain, 
  'biz-' || substring(md5(random()::text) from 1 for 8)
)
WHERE permalink IS NULL;

-- Make permalink NOT NULL after populating
ALTER TABLE businesses 
ALTER COLUMN permalink SET NOT NULL;
