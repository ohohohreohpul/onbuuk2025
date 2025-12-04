/*
  # Add Auth User Support for Businesses
  
  This migration adds support for Supabase Auth integration with businesses:
  
  ## 1. Business Schema Updates
  - Add owner_id column to link businesses to auth.users
  - Add index for owner_id lookups
  
  ## 2. Admin Users Schema Updates
  - Add user_id column to link admin_users to auth.users
  - Add is_owner flag to identify business owners
  - Add index for user_id lookups
  
  ## 3. RLS Policies
  - Allow authenticated users to create their own business
  - Allow business owners to manage their business
  - Link admin users to auth users automatically
  
  ## Security Notes
  - All changes maintain existing RLS security
  - Owner-based access control added for better security
  - Auth integration enables OAuth providers (Google, etc.)
*/

-- =====================================================
-- PART 1: Add owner_id to businesses table
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.businesses 
    ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON public.businesses(owner_id);

-- =====================================================
-- PART 2: Add user_id and is_owner to admin_users
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.admin_users 
    ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'is_owner'
  ) THEN
    ALTER TABLE public.admin_users 
    ADD COLUMN is_owner boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);

-- =====================================================
-- PART 3: Update RLS Policies for Authenticated Access
-- =====================================================

DROP POLICY IF EXISTS "Owners can manage their business" ON public.businesses;
CREATE POLICY "Owners can manage their business"
  ON public.businesses
  FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;
CREATE POLICY "Authenticated users can create businesses"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to view their admin_users record
DROP POLICY IF EXISTS "Users can view own admin record" ON public.admin_users;
CREATE POLICY "Users can view own admin record"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Allow authenticated users to update their own admin record
DROP POLICY IF EXISTS "Users can update own admin record" ON public.admin_users;
CREATE POLICY "Users can update own admin record"
  ON public.admin_users
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- =====================================================
-- PART 4: Function to Link Auth User on Admin Creation
-- =====================================================

CREATE OR REPLACE FUNCTION public.link_admin_to_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.user_id IS NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE email = NEW.email
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_link_admin_to_auth_user ON public.admin_users;
CREATE TRIGGER trigger_link_admin_to_auth_user
  BEFORE INSERT OR UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_admin_to_auth_user();

-- =====================================================
-- PART 5: Update create_admin_user function
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_admin_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_business_id UUID,
  p_is_owner BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_user_id UUID;
  v_password_hash TEXT;
  v_owner_role_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  v_password_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO admin_users (
    email,
    password_hash,
    full_name,
    business_id,
    user_id,
    is_owner,
    is_active
  )
  VALUES (
    p_email,
    v_password_hash,
    p_full_name,
    p_business_id,
    v_user_id,
    p_is_owner,
    true
  )
  RETURNING id INTO v_admin_id;

  IF p_is_owner THEN
    SELECT id INTO v_owner_role_id
    FROM roles
    WHERE business_id = p_business_id
      AND name = 'owner'
    LIMIT 1;

    IF v_owner_role_id IS NOT NULL THEN
      INSERT INTO admin_user_roles (admin_user_id, role_id)
      VALUES (v_admin_id, v_owner_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN v_admin_id;
END;
$$;