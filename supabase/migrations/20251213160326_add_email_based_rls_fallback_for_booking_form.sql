/*
  # Add Email-Based RLS Fallback for Booking Form Customization

  1. Issue
    - Current RLS policies only use auth_user_id for matching
    - If auth_user_id is not synced, admins can't insert/update
    - Some edge cases where email match should be sufficient

  2. Solution
    - Add additional RLS policies that match by email as fallback
    - Use auth.jwt() to get current user's email
    - Ensure both auth_user_id and email-based matching work

  3. Security
    - Still requires authentication
    - Still validates business ownership via admin_users table
    - Only adds email as alternative matching method
*/

-- Add email-based insert policy as fallback
CREATE POLICY "Admins can insert customization via email match"
  ON booking_form_customization
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = (auth.jwt()->>'email')
      AND is_active = true
    )
  );

-- Add email-based update policy as fallback
CREATE POLICY "Admins can update customization via email match"
  ON booking_form_customization
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = (auth.jwt()->>'email')
      AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = (auth.jwt()->>'email')
      AND is_active = true
    )
  );
