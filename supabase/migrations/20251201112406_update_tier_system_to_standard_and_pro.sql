/*
  # Update Tier System to Standard and Pro with Limitations

  1. Changes
     - Drop old plan_type constraint
     - Add new constraint supporting 'standard' and 'pro' tiers
     - Add pricing fields to businesses table:
       - monthly_price_eur (decimal)
       - monthly_price_usd (decimal) 
       - annual_price_eur (decimal)
       - annual_price_usd (decimal)
       - billing_cycle (monthly/annual)
     - Add limitation fields:
       - max_staff_count (integer, null = unlimited)
       - max_services_count (integer, null = unlimited)
       - current_staff_count (integer, for tracking)
       - current_services_count (integer, for tracking)
     - Update default plan_type from 'starter' to 'standard'
     - Keep legacy values for backward compatibility

  2. Tier Limitations
     Standard tier:
       - max_staff_count: 5
       - max_services_count: 20
       - No custom domain
       - No custom logo
       - Shows "Powered by Buuk" badge
       - No calendar sync
       - Limited form customization
     
     Pro tier:
       - Unlimited staff
       - Unlimited services
       - Custom domain
       - Custom logo
       - Hide "Powered by Buuk" badge
       - Calendar sync (Google/Outlook)
       - Full form customization
       - Advanced permissions
       - Priority support

  3. Pricing
     Standard:
       - Monthly: €30 / $35
       - Annual: €24.99 / $29.99
     Pro:
       - Monthly: €50 / $55
       - Annual: €44.99 / $49.99

  4. Security
     - No changes to RLS policies needed
     - Enforcement handled in application layer
*/

-- Drop old constraint
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_plan_type_check;

-- Add new constraint supporting standard and pro
ALTER TABLE businesses ADD CONSTRAINT businesses_plan_type_check 
  CHECK (plan_type IN ('standard', 'pro', 'starter', 'premium', 'professional', 'enterprise'));

-- Add pricing fields
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS monthly_price_eur DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS monthly_price_usd DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS annual_price_eur DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS annual_price_usd DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual'));

-- Add limitation tracking fields
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS max_staff_count INTEGER,
  ADD COLUMN IF NOT EXISTS max_services_count INTEGER,
  ADD COLUMN IF NOT EXISTS current_staff_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_services_count INTEGER DEFAULT 0;

-- Update default plan_type for new businesses
ALTER TABLE businesses ALTER COLUMN plan_type SET DEFAULT 'standard';

-- Migrate existing 'starter' to 'standard', 'premium' to 'pro'
UPDATE businesses 
SET plan_type = 'standard'
WHERE plan_type IN ('starter', 'professional');

UPDATE businesses 
SET plan_type = 'pro'
WHERE plan_type IN ('premium', 'enterprise');

-- Set limitations for standard tier businesses
UPDATE businesses 
SET 
  max_staff_count = 5,
  max_services_count = 20
WHERE plan_type = 'standard';

-- Set unlimited for pro tier businesses (null = unlimited)
UPDATE businesses 
SET 
  max_staff_count = NULL,
  max_services_count = NULL
WHERE plan_type = 'pro';

-- Create function to update staff count
CREATE OR REPLACE FUNCTION update_business_staff_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE businesses 
    SET current_staff_count = (
      SELECT COUNT(*) FROM specialists WHERE business_id = NEW.business_id
    )
    WHERE id = NEW.business_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE businesses 
    SET current_staff_count = (
      SELECT COUNT(*) FROM specialists WHERE business_id = OLD.business_id
    )
    WHERE id = OLD.business_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update services count
CREATE OR REPLACE FUNCTION update_business_services_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE businesses 
    SET current_services_count = (
      SELECT COUNT(*) FROM services WHERE business_id = NEW.business_id
    )
    WHERE id = NEW.business_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE businesses 
    SET current_services_count = (
      SELECT COUNT(*) FROM services WHERE business_id = OLD.business_id
    )
    WHERE id = OLD.business_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_staff_count ON specialists;
DROP TRIGGER IF EXISTS trigger_update_services_count ON services;

-- Create triggers to maintain counts
CREATE TRIGGER trigger_update_staff_count
AFTER INSERT OR DELETE ON specialists
FOR EACH ROW
EXECUTE FUNCTION update_business_staff_count();

CREATE TRIGGER trigger_update_services_count
AFTER INSERT OR DELETE ON services
FOR EACH ROW
EXECUTE FUNCTION update_business_services_count();

-- Initialize current counts for existing businesses
UPDATE businesses b
SET current_staff_count = (
  SELECT COUNT(*) FROM specialists WHERE business_id = b.id
);

UPDATE businesses b
SET current_services_count = (
  SELECT COUNT(*) FROM services WHERE business_id = b.id
);

-- Add comments
COMMENT ON COLUMN businesses.plan_type IS 'Subscription tier: standard (limited features) or pro (unlimited features)';
COMMENT ON COLUMN businesses.max_staff_count IS 'Maximum staff allowed. NULL = unlimited (Pro tier)';
COMMENT ON COLUMN businesses.max_services_count IS 'Maximum services allowed. NULL = unlimited (Pro tier)';
COMMENT ON COLUMN businesses.current_staff_count IS 'Current number of staff members';
COMMENT ON COLUMN businesses.current_services_count IS 'Current number of services';
COMMENT ON COLUMN businesses.monthly_price_eur IS 'Monthly subscription price in EUR';
COMMENT ON COLUMN businesses.monthly_price_usd IS 'Monthly subscription price in USD';
COMMENT ON COLUMN businesses.annual_price_eur IS 'Annual subscription price in EUR';
COMMENT ON COLUMN businesses.annual_price_usd IS 'Annual subscription price in USD';
COMMENT ON COLUMN businesses.billing_cycle IS 'Current billing cycle: monthly or annual';