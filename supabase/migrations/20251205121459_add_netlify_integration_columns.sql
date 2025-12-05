/*
  # Add Netlify Integration Columns to Custom Domains

  1. Changes to `custom_domains` table
    - Add `netlify_domain_id` (text) - Stores Netlify's internal domain ID for tracking
    - Add `ssl_certificate_status` (text) - Tracks SSL provisioning status: 'pending', 'provisioning', 'active', 'failed'
    - Add `provisioned_at` (timestamptz) - When domain was successfully added to Netlify
    - Add `netlify_api_error` (text) - Stores any Netlify-specific API errors
    - Add index on `domain` column for fast hostname lookups
  
  2. Important Notes
    - These columns enable full tracking of Netlify domain provisioning lifecycle
    - SSL status tracking allows monitoring of certificate provisioning
    - Indexes improve performance for tenant detection by hostname
*/

-- Add Netlify tracking columns
DO $$
BEGIN
  -- Add netlify_domain_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_domains' AND column_name = 'netlify_domain_id'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN netlify_domain_id text;
  END IF;

  -- Add ssl_certificate_status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_domains' AND column_name = 'ssl_certificate_status'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN ssl_certificate_status text DEFAULT 'pending' CHECK (ssl_certificate_status IN ('pending', 'provisioning', 'active', 'failed'));
  END IF;

  -- Add provisioned_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_domains' AND column_name = 'provisioned_at'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN provisioned_at timestamptz;
  END IF;

  -- Add netlify_api_error if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_domains' AND column_name = 'netlify_api_error'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN netlify_api_error text;
  END IF;
END $$;

-- Create index on domain column for fast tenant detection
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);

-- Create index on business_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_custom_domains_business_id ON custom_domains(business_id);

-- Create index on status for monitoring
CREATE INDEX IF NOT EXISTS idx_custom_domains_status ON custom_domains(status) WHERE status IN ('pending', 'provisioning');