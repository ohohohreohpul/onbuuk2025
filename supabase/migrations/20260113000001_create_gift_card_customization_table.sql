/*
  # Create Gift Card Customization Table
  
  1. New Table: gift_card_customization
    - Stores customizable text for gift card purchase page
    - One-to-one relationship with businesses
    - Allows businesses to customize all text labels on the gift card purchase flow
  
  2. Fields:
    - Page header: title, subtitle
    - Amount selection: select_amount_label, enter_custom_label, use_preset_label
    - Recipient details: recipient_email_label, recipient_email_helper
    - Personal message: message_label
    - Buyer details: your_details_label, your_name_label, your_email_label
    - Purchase buttons: continue_payment_button, complete_purchase_button
  
  3. Security:
    - Enable RLS on gift_card_customization table
    - Admins can manage their business's customization
    - Public users can read customization for gift card purchase flow
*/

-- Create gift_card_customization table
CREATE TABLE IF NOT EXISTS gift_card_customization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Page header
  title text DEFAULT 'Purchase a Gift Card',
  subtitle text DEFAULT 'Give the gift of choice with a gift card',
  
  -- Amount selection section
  select_amount_label text DEFAULT 'Select Amount',
  enter_custom_label text DEFAULT 'Enter custom amount',
  use_preset_label text DEFAULT 'Use preset amount',
  
  -- Recipient email section
  recipient_email_label text DEFAULT 'Recipient Email (Optional)',
  recipient_email_helper text DEFAULT 'Leave blank to purchase for yourself, or enter an email to send as a gift',
  
  -- Personal message section
  message_label text DEFAULT 'Personal Message (Optional)',
  
  -- Buyer details section
  your_details_label text DEFAULT 'Your Details',
  your_name_label text DEFAULT 'Your Name',
  your_email_label text DEFAULT 'Your Email',
  
  -- Purchase buttons
  continue_payment_button text DEFAULT 'Continue to Payment',
  complete_purchase_button text DEFAULT 'Complete Purchase',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE gift_card_customization ENABLE ROW LEVEL SECURITY;

-- Drop the existing policy if it exists (from the incomplete migration)
DROP POLICY IF EXISTS "Admins can insert gift card customization" ON gift_card_customization;

-- Admins can view their business's customization
CREATE POLICY "Admins can view their business gift card customization"
  ON gift_card_customization
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Admins can insert customization for their business
CREATE POLICY "Admins can insert their business gift card customization"
  ON gift_card_customization
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Admins can update their business's customization
CREATE POLICY "Admins can update their business gift card customization"
  ON gift_card_customization
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Public users can read customization for gift card purchase flow
CREATE POLICY "Public can read gift card customization"
  ON gift_card_customization
  FOR SELECT
  TO public
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gift_card_customization_business 
  ON gift_card_customization(business_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_gift_card_customization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gift_card_customization_updated_at
  BEFORE UPDATE ON gift_card_customization
  FOR EACH ROW
  EXECUTE FUNCTION update_gift_card_customization_updated_at();
