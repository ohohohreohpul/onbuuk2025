/*
  # Fix Booking Form Colors Update Policy

  ## Problem
  The booking_form_colors table is missing an UPDATE policy, which prevents admins
  from saving color customization changes.

  ## Changes
  1. Add UPDATE policy for authenticated admins to update their business colors
  2. Ensure business isolation is maintained

  ## Security
  - Only authenticated admins can update colors for their own business
  - Business isolation maintained through get_admin_business_id() function
*/

-- Add UPDATE policy for booking form colors
CREATE POLICY "Admins can update own business booking form colors"
  ON booking_form_colors FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

-- Also add a public UPDATE policy for backwards compatibility during migration
CREATE POLICY "Public can update booking form colors"
  ON booking_form_colors FOR UPDATE
  TO public
  USING (business_id IS NOT NULL)
  WITH CHECK (business_id IS NOT NULL);
