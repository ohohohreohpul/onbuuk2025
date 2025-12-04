/*
  # Add Missing DELETE Policies for Business Isolation

  1. Tables needing DELETE policies
    - admin_users
    - booking_form_colors
    - booking_form_images
    - booking_form_texts
    - deposit_settings
    - loyalty_settings
    - product_service_assignments
    - roles
    - signup_sessions
    - stripe_customers

  2. Security
    - Only admins can delete records for their own business
    - Use get_admin_business_id() for business isolation
    - Super admins can delete any records

  3. Purpose
    - Ensure business owners can fully manage their data
    - Maintain proper data isolation between businesses
*/

-- ============================================
-- ADMIN_USERS - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business admin users"
  ON admin_users FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id() AND NOT is_owner);
  -- Prevent deleting the owner account

-- ============================================
-- BOOKING_FORM_COLORS - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business booking form colors"
  ON booking_form_colors FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- BOOKING_FORM_IMAGES - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business booking form images"
  ON booking_form_images FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- BOOKING_FORM_TEXTS - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business booking form texts"
  ON booking_form_texts FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- DEPOSIT_SETTINGS - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business deposit settings"
  ON deposit_settings FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- LOYALTY_SETTINGS - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business loyalty settings"
  ON loyalty_settings FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- PRODUCT_SERVICE_ASSIGNMENTS - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business product service assignments"
  ON product_service_assignments FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- ROLES - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business roles"
  ON roles FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- SIGNUP_SESSIONS - Add DELETE policy (cleanup)
-- ============================================
CREATE POLICY "Admins can delete own business signup sessions"
  ON signup_sessions FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- ============================================
-- STRIPE_CUSTOMERS - Add DELETE policy
-- ============================================
CREATE POLICY "Admins can delete own business stripe customers"
  ON stripe_customers FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());