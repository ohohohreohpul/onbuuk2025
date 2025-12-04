/*
  # Add Netlify Domain Integration Fields

  ## Overview
  This migration adds Netlify-specific fields to the custom_domains table for
  complete integration with Netlify's domain and SSL management system.

  ## Changes to custom_domains table
  
  ### New Columns
  - `netlify_domain_id` (text) - Netlify's internal domain ID after adding via API
  - `netlify_site_id` (text) - The Netlify site ID this domain is associated with
  - `target_cname` (text) - The Netlify domain to CNAME to (e.g., your-app.netlify.app)
  - `dns_configured` (boolean) - Whether CNAME/A record is properly configured
  - `cname_verified_at` (timestamptz) - When CNAME configuration was verified
  - `ssl_status` (text) - SSL certificate status: 'pending', 'provisioning', 'active', 'failed'
  - `ssl_provisioned_at` (timestamptz) - When SSL certificate became active
  - `ssl_expires_at` (timestamptz) - When SSL certificate expires
  - `netlify_error` (text) - Any error messages from Netlify API
  - `auto_handle_www` (boolean) - Whether to automatically handle www variant

  ## Security
  - All existing RLS policies continue to apply
  - No changes to access control

  ## Notes
  - Default ssl_status is 'pending' for new domains
  - dns_configured defaults to false
  - auto_handle_www defaults to true for convenience
*/

-- Add Netlify integration columns to custom_domains
DO $$ 
BEGIN
  -- Add netlify_domain_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'netlify_domain_id'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN netlify_domain_id text;
  END IF;

  -- Add netlify_site_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'netlify_site_id'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN netlify_site_id text;
  END IF;

  -- Add target_cname if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'target_cname'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN target_cname text;
  END IF;

  -- Add dns_configured if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'dns_configured'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN dns_configured boolean DEFAULT false;
  END IF;

  -- Add cname_verified_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'cname_verified_at'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN cname_verified_at timestamptz;
  END IF;

  -- Add ssl_status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'ssl_status'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN ssl_status text DEFAULT 'pending' 
      CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'failed'));
  END IF;

  -- Add ssl_provisioned_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'ssl_provisioned_at'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN ssl_provisioned_at timestamptz;
  END IF;

  -- Add ssl_expires_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'ssl_expires_at'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN ssl_expires_at timestamptz;
  END IF;

  -- Add netlify_error if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'netlify_error'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN netlify_error text;
  END IF;

  -- Add auto_handle_www if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'custom_domains' AND column_name = 'auto_handle_www'
  ) THEN
    ALTER TABLE custom_domains ADD COLUMN auto_handle_www boolean DEFAULT true;
  END IF;
END $$;

-- Create index for Netlify domain ID lookups
CREATE INDEX IF NOT EXISTS idx_custom_domains_netlify_id ON custom_domains(netlify_domain_id);

-- Create index for SSL status filtering
CREATE INDEX IF NOT EXISTS idx_custom_domains_ssl_status ON custom_domains(ssl_status);

-- Create index for DNS configured lookups
CREATE INDEX IF NOT EXISTS idx_custom_domains_dns_configured ON custom_domains(dns_configured);

-- Comment on the new columns for documentation
COMMENT ON COLUMN custom_domains.netlify_domain_id IS 'Netlify internal domain ID from their API';
COMMENT ON COLUMN custom_domains.netlify_site_id IS 'Netlify site ID this domain is associated with';
COMMENT ON COLUMN custom_domains.target_cname IS 'The Netlify domain users should CNAME to';
COMMENT ON COLUMN custom_domains.dns_configured IS 'Whether CNAME/A record is properly configured';
COMMENT ON COLUMN custom_domains.ssl_status IS 'SSL certificate provisioning status from Netlify';
COMMENT ON COLUMN custom_domains.ssl_provisioned_at IS 'Timestamp when SSL certificate became active';
COMMENT ON COLUMN custom_domains.auto_handle_www IS 'Whether to automatically handle www variant of domain';
