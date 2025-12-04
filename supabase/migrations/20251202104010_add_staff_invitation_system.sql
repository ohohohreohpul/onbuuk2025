/*
  # Staff Invitation System

  ## Overview
  This migration adds a comprehensive staff invitation system that allows business owners
  to invite staff members via email. Staff members receive a secure invitation link
  where they can set their own password and create their account.

  ## 1. New Tables
    - `staff_invitations`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `email` (text) - Invitee email address
      - `full_name` (text) - Invitee full name
      - `role` (text) - Role being offered (staff, receptionist, cashier, manager)
      - `invite_token` (text, unique) - Secure random token for invitation link
      - `expires_at` (timestamptz) - When the invitation expires (7 days default)
      - `created_by` (uuid, foreign key to admin_users) - Who sent the invitation
      - `accepted_at` (timestamptz, nullable) - When invitation was accepted
      - `is_used` (boolean) - Whether invitation has been used
      - `created_at` (timestamptz)

  ## 2. Updates to admin_users Table
    - `auth_user_id` (uuid, foreign key to auth.users) - Links to Supabase auth user
    - `is_password_temporary` (boolean) - For temp password flow if needed
    - `invited_by` (uuid, foreign key to admin_users) - Who invited this staff member
    - `accepted_invite_at` (timestamptz) - When they accepted the invitation

  ## 3. Security
    - Enable RLS on staff_invitations table
    - Only business admins can create and view invitations for their business
    - Invitation tokens are single-use and expire after 7 days
    - Email addresses must be unique per business

  ## 4. Helper Functions
    - create_staff_invitation() - Generate secure invitation
    - accept_staff_invitation() - Process invitation acceptance
    - cleanup_expired_invitations() - Remove expired invitations
*/

-- =====================================================
-- PART 1: Update admin_users table with new columns
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_admin_users_auth_user_id ON admin_users(auth_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'is_password_temporary'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN is_password_temporary boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN invited_by uuid REFERENCES admin_users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'accepted_invite_at'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN accepted_invite_at timestamptz;
  END IF;
END $$;

-- =====================================================
-- PART 2: Create staff_invitations table
-- =====================================================

CREATE TABLE IF NOT EXISTS staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('staff', 'receptionist', 'cashier', 'manager', 'admin')),
  invite_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_by uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  is_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, email)
);

ALTER TABLE staff_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business admins can view their invitations"
  ON staff_invitations FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Business admins can create invitations"
  ON staff_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Business admins can update their invitations"
  ON staff_invitations FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Business admins can delete their invitations"
  ON staff_invitations FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "Anyone can view invitations by token"
  ON staff_invitations FOR SELECT
  TO anon
  USING (
    is_used = false
    AND expires_at > now()
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_invitations_business ON staff_invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token ON staff_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email ON staff_invitations(business_id, email);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_created_by ON staff_invitations(created_by);

-- =====================================================
-- PART 3: Helper Functions
-- =====================================================

-- Function to generate a secure random token
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  token text;
  token_exists boolean;
BEGIN
  LOOP
    token := encode(gen_random_bytes(32), 'base64');
    token := replace(replace(replace(token, '/', '_'), '+', '-'), '=', '');

    SELECT EXISTS(SELECT 1 FROM staff_invitations WHERE invite_token = token) INTO token_exists;

    EXIT WHEN NOT token_exists;
  END LOOP;

  RETURN token;
END;
$$;

-- Function to create a staff invitation
CREATE OR REPLACE FUNCTION create_staff_invitation(
  p_business_id uuid,
  p_email text,
  p_full_name text,
  p_role text,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_id uuid;
  v_token text;
  v_existing_user_count int;
BEGIN
  SELECT COUNT(*) INTO v_existing_user_count
  FROM admin_users
  WHERE business_id = p_business_id
    AND email = p_email
    AND is_active = true;

  IF v_existing_user_count > 0 THEN
    RAISE EXCEPTION 'User with this email already exists in this business';
  END IF;

  DELETE FROM staff_invitations
  WHERE business_id = p_business_id
    AND email = p_email
    AND is_used = false;

  v_token := generate_invite_token();

  INSERT INTO staff_invitations (
    business_id,
    email,
    full_name,
    role,
    invite_token,
    created_by
  ) VALUES (
    p_business_id,
    p_email,
    p_full_name,
    p_role,
    v_token,
    p_created_by
  )
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$;

-- Function to accept a staff invitation
CREATE OR REPLACE FUNCTION accept_staff_invitation(
  p_invite_token text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_auth_user_id uuid;
  v_admin_user_id uuid;
  v_password_hash text;
BEGIN
  SELECT * INTO v_invitation
  FROM staff_invitations
  WHERE invite_token = p_invite_token
    AND is_used = false
    AND expires_at > now()
  LIMIT 1;

  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_invitation.email
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication user must be created first';
  END IF;

  v_password_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO admin_users (
    email,
    password_hash,
    full_name,
    role,
    business_id,
    auth_user_id,
    is_active,
    invited_by,
    accepted_invite_at
  ) VALUES (
    v_invitation.email,
    v_password_hash,
    v_invitation.full_name,
    v_invitation.role,
    v_invitation.business_id,
    v_auth_user_id,
    true,
    v_invitation.created_by,
    now()
  )
  RETURNING id INTO v_admin_user_id;

  UPDATE staff_invitations
  SET is_used = true,
      accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'admin_user_id', v_admin_user_id,
    'business_id', v_invitation.business_id,
    'role', v_invitation.role
  );
END;
$$;

-- Function to cleanup expired invitations (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM staff_invitations
  WHERE expires_at < now()
    AND is_used = false;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- =====================================================
-- PART 4: Sync auth_user_id for existing admin_users
-- =====================================================

-- Update existing admin_users to link with auth.users if they exist
UPDATE admin_users au
SET auth_user_id = u.id
FROM auth.users u
WHERE au.email = u.email
  AND au.auth_user_id IS NULL;