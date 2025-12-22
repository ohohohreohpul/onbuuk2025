/*
  # Add INSERT policy for gift card customization
  
  Allows admins to create new gift card customization records for their business
*/

CREATE POLICY "Admins can insert gift card customization"
  ON gift_card_customization FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users WHERE auth_user_id = auth.uid()
    )
  );