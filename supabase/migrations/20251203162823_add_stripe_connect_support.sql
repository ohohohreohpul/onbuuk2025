/*
  # Add Stripe Connect Support for Multi-Tenant Platform

  1. Schema Changes to businesses table
    - `stripe_connect_account_id` (text, nullable) - Stripe Connected Account ID
    - `stripe_connect_onboarding_complete` (boolean) - Whether onboarding is complete
    - `stripe_connect_charges_enabled` (boolean) - Whether account can accept charges
    - `stripe_connect_payouts_enabled` (boolean) - Whether account can receive payouts
    - `stripe_connect_country` (text) - Account country (DE, US, etc.)
    - `stripe_account_type` (text) - Account type (standard, express, custom)
    - `platform_fee_percentage` (numeric) - Platform fee percentage (e.g., 2.5 for 2.5%)
    - `stripe_connect_details_submitted` (boolean) - Whether details have been submitted
    - `stripe_connect_created_at` (timestamptz) - When Connect account was created

  2. Security
    - Maintains existing RLS policies on businesses table
    - Connect data only accessible by business owners and platform admins

  3. Important Notes
    - Supports Standard Connect accounts for DE, EU, and US regions
    - Platform fee calculated as application_fee during checkout
    - Businesses receive direct payouts to their bank accounts
*/

-- Add Stripe Connect columns to businesses table
DO $$
BEGIN
  -- Add stripe_connect_account_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_connect_account_id'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_connect_account_id text UNIQUE;
  END IF;

  -- Add stripe_connect_onboarding_complete
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_connect_onboarding_complete'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_connect_onboarding_complete boolean DEFAULT false;
  END IF;

  -- Add stripe_connect_charges_enabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_connect_charges_enabled'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_connect_charges_enabled boolean DEFAULT false;
  END IF;

  -- Add stripe_connect_payouts_enabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_connect_payouts_enabled'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_connect_payouts_enabled boolean DEFAULT false;
  END IF;

  -- Add stripe_connect_country
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_connect_country'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_connect_country text;
  END IF;

  -- Add stripe_account_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_account_type'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_account_type text DEFAULT 'standard' CHECK (stripe_account_type IN ('standard', 'express', 'custom'));
  END IF;

  -- Add platform_fee_percentage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'platform_fee_percentage'
  ) THEN
    ALTER TABLE businesses ADD COLUMN platform_fee_percentage numeric(5,2) DEFAULT 2.50;
  END IF;

  -- Add stripe_connect_details_submitted
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_connect_details_submitted'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_connect_details_submitted boolean DEFAULT false;
  END IF;

  -- Add stripe_connect_created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_connect_created_at'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_connect_created_at timestamptz;
  END IF;
END $$;

-- Create index on stripe_connect_account_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_stripe_connect_account
  ON businesses(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- Create index on stripe_connect_onboarding_complete for filtering
CREATE INDEX IF NOT EXISTS idx_businesses_stripe_onboarding_complete
  ON businesses(stripe_connect_onboarding_complete)
  WHERE stripe_connect_onboarding_complete = true;

-- Add comment explaining the platform fee
COMMENT ON COLUMN businesses.platform_fee_percentage IS 'Platform fee percentage charged on transactions (e.g., 2.5 means 2.5% fee)';