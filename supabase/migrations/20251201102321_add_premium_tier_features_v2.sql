/*
  # Add Premium Tier Features and Super Admin Support
  
  1. Changes Made
     - Add premium feature fields to businesses table:
       - custom_logo_url (Premium only feature)
       - hide_powered_by_badge (Premium only feature)
       - calendar_integration_enabled (Premium only feature)
     - Add is_super_admin flag to admin_users for buuk team access
     - Set default logo for all existing businesses
     - Create super admin function
  
  2. Security
     - RLS policies remain unchanged (business isolation)
     - Super admins have same business_id restrictions (no cross-business access)
  
  3. Notes
     - Existing businesses keep their current plan_type
     - Premium features are controlled in the application layer
     - subdomain/custom_domain fields remain for all tiers
*/

-- Add premium feature columns to businesses table
ALTER TABLE businesses 
  ADD COLUMN IF NOT EXISTS custom_logo_url TEXT DEFAULT '/defbuuklogo.png',
  ADD COLUMN IF NOT EXISTS hide_powered_by_badge BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_integration_enabled BOOLEAN DEFAULT false;

-- Add super admin flag to admin_users
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Set default logo for all existing businesses that don't have one
UPDATE businesses 
SET custom_logo_url = '/defbuuklogo.png'
WHERE custom_logo_url IS NULL OR custom_logo_url = '';

-- Create function to create super admin user
CREATE OR REPLACE FUNCTION create_super_admin_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_business_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update admin_users record with super admin flag
  INSERT INTO admin_users (
    business_id,
    email,
    password_hash,
    full_name,
    role,
    is_owner,
    is_super_admin,
    is_active
  )
  VALUES (
    p_business_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    p_full_name,
    'owner',
    true,
    true,
    true
  )
  ON CONFLICT (business_id, email) 
  DO UPDATE SET
    is_super_admin = true,
    is_active = true,
    role = 'owner',
    is_owner = true;
END;
$$;

-- Create comment explaining premium features
COMMENT ON COLUMN businesses.custom_logo_url IS 'Custom brand logo URL. Default: /defbuuklogo.png. Premium users can upload custom logos.';
COMMENT ON COLUMN businesses.hide_powered_by_badge IS 'Hide "Powered by buuk" badge on booking pages (Premium only)';
COMMENT ON COLUMN businesses.calendar_integration_enabled IS 'Enable Google/Outlook calendar sync (Premium only)';
COMMENT ON COLUMN admin_users.is_super_admin IS 'Super admin flag for buuk team members with premium access';
