/*
  # Add Free Tier and Remove Signup Paywall

  1. Changes
    - Add 'free' plan type to businesses table
    - Keep 'starter' as an alias for 'free'
    - Set all new businesses to 'free' tier by default
    - Make Stripe fields nullable
  
  2. Free Tier Limitations
    - Max 1 admin user (owner only)
    - Max 50 bookings per month
    - Max 3 services
    - Max 1 specialist
    - No gift cards
    - No loyalty program
    - No custom branding
    - No SMS notifications
    - Email notifications only
  
  3. Standard Tier ($29/month)
    - Max 3 admin users
    - Unlimited bookings
    - Max 10 services
    - Max 3 specialists
    - Gift cards enabled
    - Basic loyalty program
    - Custom logo
    - Email notifications
  
  4. Pro Tier ($79/month)
    - Unlimited admin users
    - Unlimited bookings
    - Unlimited services
    - Unlimited specialists
    - Advanced gift cards
    - Advanced loyalty program
    - Full custom branding
    - Email + SMS notifications
    - Priority support
*/

-- Update the plan_type constraint to include 'free' and 'starter'
ALTER TABLE businesses 
DROP CONSTRAINT IF EXISTS businesses_plan_type_check;

ALTER TABLE businesses
ADD CONSTRAINT businesses_plan_type_check 
CHECK (plan_type IN ('free', 'starter', 'standard', 'pro'));

-- Set default plan_type to 'free' for new businesses
ALTER TABLE businesses 
ALTER COLUMN plan_type SET DEFAULT 'free';

-- Make stripe fields nullable since free tier doesn't need them
ALTER TABLE businesses
ALTER COLUMN stripe_customer_id DROP NOT NULL;

ALTER TABLE businesses
ALTER COLUMN stripe_subscription_id DROP NOT NULL;