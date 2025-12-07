/*
  # Fix RLS Policies Blocking Legitimate INSERT Operations

  ## Problem
  The previous RLS security fixes were too restrictive and blocked legitimate service and product creation.
  The `get_admin_business_id()` function had multiple conflicting versions checking different columns.

  ## Changes

  ### 1. Bulletproof get_admin_business_id() Function
  - Checks all possible auth column variations (auth_user_id, user_id, email)
  - Returns correct business_id regardless of which auth method was used
  - Handles legacy admin_users records

  ### 2. Services Table
  - Relaxed INSERT policy to allow authenticated admins to insert with their business_id
  - Maintained business isolation for SELECT, UPDATE, DELETE

  ### 3. Products Table
  - Relaxed INSERT policy for authenticated admins
  - Maintained business isolation

  ### 4. Related Tables
  - service_durations: Allow INSERT when business_id matches
  - product_service_assignments: Allow INSERT when business_id matches
  - specialist_services: Allow INSERT when business_id matches
  - booking_form_* tables: Allow INSERT for business admins

  ## Security
  - Businesses remain isolated from each other
  - Only authenticated admins can insert data for their business
  - No cross-business data access possible
*/

-- =====================================================
-- PART 1: Create Bulletproof get_admin_business_id() Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_admin_business_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_auth_uid uuid;
BEGIN
  -- Get the current authenticated user ID
  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try method 1: Check auth_user_id column (newest method)
  SELECT business_id INTO v_business_id
  FROM admin_users
  WHERE auth_user_id = v_auth_uid
    AND is_active = true
  LIMIT 1;

  IF v_business_id IS NOT NULL THEN
    RETURN v_business_id;
  END IF;

  -- Try method 2: Check user_id column (middle method)
  SELECT business_id INTO v_business_id
  FROM admin_users
  WHERE user_id = v_auth_uid
    AND is_active = true
  LIMIT 1;

  IF v_business_id IS NOT NULL THEN
    RETURN v_business_id;
  END IF;

  -- Try method 3: Check email match (oldest method)
  SELECT business_id INTO v_business_id
  FROM admin_users
  WHERE email = (SELECT email FROM auth.users WHERE id = v_auth_uid)
    AND is_active = true
  LIMIT 1;

  RETURN v_business_id;
END;
$$;

-- =====================================================
-- PART 2: Fix Services Table Policies
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business services" ON services;

CREATE POLICY "Admins can insert own business services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 3: Fix Service Durations Table Policies
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business service durations" ON service_durations;

CREATE POLICY "Admins can insert own business service durations"
  ON service_durations FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 4: Fix Products Table Policies
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business products" ON products;

CREATE POLICY "Admins can insert own business products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 5: Fix Product Service Assignments
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business product assignments" ON product_service_assignments;

CREATE POLICY "Admins can insert own business product assignments"
  ON product_service_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 6: Fix Specialists Table Policies
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business specialists" ON specialists;

CREATE POLICY "Admins can insert own business specialists"
  ON specialists FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 7: Fix Specialist Services Table
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business specialist services" ON specialist_services;

CREATE POLICY "Admins can insert own business specialist services"
  ON specialist_services FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 8: Fix Booking Form Customization Tables
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business booking form colors" ON booking_form_colors;

CREATE POLICY "Admins can insert own business booking form colors"
  ON booking_form_colors FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

DROP POLICY IF EXISTS "Admins can insert own business booking form images" ON booking_form_images;

CREATE POLICY "Admins can insert own business booking form images"
  ON booking_form_images FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

DROP POLICY IF EXISTS "Admins can insert own business booking form texts" ON booking_form_texts;

CREATE POLICY "Admins can insert own business booking form texts"
  ON booking_form_texts FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 9: Fix Email and Notification Settings
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business email settings" ON email_settings;

CREATE POLICY "Admins can insert own business email settings"
  ON email_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

DROP POLICY IF EXISTS "Admins can insert own business notification templates" ON notification_templates;

CREATE POLICY "Admins can insert own business notification templates"
  ON notification_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

DROP POLICY IF EXISTS "Admins can insert own business sms settings" ON sms_settings;

CREATE POLICY "Admins can insert own business sms settings"
  ON sms_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 10: Fix Working Hours and Time Blocks
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business working hours" ON working_hours;

CREATE POLICY "Admins can insert own business working hours"
  ON working_hours FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

DROP POLICY IF EXISTS "Admins can insert own business time blocks" ON time_blocks;

CREATE POLICY "Admins can insert own business time blocks"
  ON time_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 11: Fix Deposit and Fee Settings
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business deposit settings" ON deposit_settings;

CREATE POLICY "Admins can insert own business deposit settings"
  ON deposit_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

-- =====================================================
-- PART 12: Fix Role Management Tables
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business roles" ON roles;

CREATE POLICY "Admins can insert own business roles"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );

DROP POLICY IF EXISTS "Admins can insert own business role permissions" ON role_permissions;

CREATE POLICY "Admins can insert own business role permissions"
  ON role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles WHERE business_id = get_admin_business_id()
    )
  );

-- =====================================================
-- PART 13: Fix Gift Card Settings
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert own business gift card settings" ON gift_card_settings;

CREATE POLICY "Admins can insert own business gift card settings"
  ON gift_card_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id = get_admin_business_id()
  );