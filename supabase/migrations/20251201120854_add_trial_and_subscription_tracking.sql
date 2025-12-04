/*
  # Add Trial and Subscription Tracking

  1. Changes to `businesses` table
    - Add `trial_end_date` (timestamptz) - When the trial period ends
    - Add `stripe_customer_id` (text) - Link to Stripe customer
    - Add `stripe_subscription_id` (text) - Link to active Stripe subscription
    - Add `subscription_status` (text) - Current subscription status (trialing, active, past_due, canceled, etc.)
    
  2. Changes to `stripe_customers` table
    - Add `business_id` (uuid) - Link Stripe customer to business
    
  3. Security
    - Update RLS policies to allow business owners to view their subscription data
*/

-- Add subscription tracking fields to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'trial_end_date'
  ) THEN
    ALTER TABLE businesses ADD COLUMN trial_end_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE businesses ADD COLUMN stripe_subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE businesses ADD COLUMN subscription_status text DEFAULT 'incomplete';
  END IF;
END $$;

-- Add business_id to stripe_customers table to link customers to businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stripe_customers' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE stripe_customers ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stripe_customers_business_id ON stripe_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_stripe_customer_id ON businesses(stripe_customer_id);