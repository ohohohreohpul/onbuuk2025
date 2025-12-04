/*
  # Add Pay in Person Payment Option

  1. Changes
    - Add default setting for pay_in_person option to site_settings
    - This allows businesses to enable customers to pay at the store

  2. Important Notes
    - When enabled, customers can choose between Stripe and Pay in Person
    - Bookings with pay_in_person will have payment_status = 'pending'
    - Admins can mark these as paid later in the POS system
*/

-- Insert default pay_in_person setting for all businesses
INSERT INTO site_settings (business_id, key, value, category)
SELECT id, 'allow_pay_in_person', 'false', 'payment'
FROM businesses
WHERE NOT EXISTS (
  SELECT 1 FROM site_settings 
  WHERE site_settings.business_id = businesses.id 
  AND site_settings.key = 'allow_pay_in_person'
);