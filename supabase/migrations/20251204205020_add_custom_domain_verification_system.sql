/*
  # Custom Domain Verification System

  ## Overview
  This migration adds support for custom domain verification, allowing businesses
  to connect their own domains to their booking sites.

  ## New Tables
  
  ### `custom_domains`
  Stores all custom domains and their verification status.
  - `id` (uuid, primary key)
  - `business_id` (uuid, foreign key to businesses)
  - `domain` (text, unique) - The custom domain (e.g., "bookings.example.com")
  - `verification_token` (text) - Random token to verify domain ownership
  - `verification_type` (text) - Type of DNS record needed (default: 'TXT')
  - `status` (text) - Current verification status: 'pending', 'verified', 'failed'
  - `verified_at` (timestamptz) - When domain was successfully verified
  - `last_checked_at` (timestamptz) - Last time we checked DNS records
  - `error_message` (text) - Error details if verification failed
  - `is_primary` (boolean) - Whether this is the primary custom domain
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Businesses can only view/manage their own custom domains
  - Authenticated admin users can insert/update/delete their business domains
  
  ## Indexes
  - Index on business_id for fast lookups
  - Index on domain for uniqueness and fast verification checks
  - Index on status for filtering pending/verified domains
*/

-- Create custom_domains table
CREATE TABLE IF NOT EXISTS custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  verification_type text NOT NULL DEFAULT 'TXT',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  verified_at timestamptz,
  last_checked_at timestamptz,
  error_message text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_domains_business_id ON custom_domains(business_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);
CREATE INDEX IF NOT EXISTS idx_custom_domains_status ON custom_domains(status);
CREATE INDEX IF NOT EXISTS idx_custom_domains_pending ON custom_domains(status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;

-- Helper function to get admin's business_id
-- (already exists from previous migrations, but adding IF NOT EXISTS for safety)
CREATE OR REPLACE FUNCTION get_admin_business_id() 
RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
BEGIN
  SELECT business_id INTO v_business_id
  FROM admin_users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  RETURN v_business_id;
END;
$$;

-- RLS Policies for custom_domains

-- Allow authenticated admin users to view their business's domains
CREATE POLICY "Admins can view own business domains"
  ON custom_domains
  FOR SELECT
  TO authenticated
  USING (business_id = get_admin_business_id());

-- Allow authenticated admin users to insert domains for their business
CREATE POLICY "Admins can insert own business domains"
  ON custom_domains
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

-- Allow authenticated admin users to update their business's domains
CREATE POLICY "Admins can update own business domains"
  ON custom_domains
  FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

-- Allow authenticated admin users to delete their business's domains
CREATE POLICY "Admins can delete own business domains"
  ON custom_domains
  FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- Allow public users to check domain verification status (needed for routing)
CREATE POLICY "Public can view verified domains"
  ON custom_domains
  FOR SELECT
  TO public
  USING (status = 'verified');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_domains_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_custom_domains_updated_at ON custom_domains;
CREATE TRIGGER set_custom_domains_updated_at
  BEFORE UPDATE ON custom_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_domains_updated_at();

-- Function to ensure only one primary domain per business
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    -- Unset is_primary for all other domains in this business
    UPDATE custom_domains
    SET is_primary = false
    WHERE business_id = NEW.business_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to maintain single primary domain
DROP TRIGGER IF EXISTS enforce_single_primary_domain ON custom_domains;
CREATE TRIGGER enforce_single_primary_domain
  BEFORE INSERT OR UPDATE ON custom_domains
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION ensure_single_primary_domain();