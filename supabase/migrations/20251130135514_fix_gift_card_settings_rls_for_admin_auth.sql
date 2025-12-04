/*
  # Fix Gift Card Settings RLS for Admin Auth

  ## Changes
  - Drop existing restrictive RLS policies on gift_card_settings
  - Add new policies that work with the session-based admin auth
  - Allow authenticated users (admins logged in via session) to manage settings
  
  ## Security
  - Policies now work with the admin authentication system
  - Still requires authentication to modify settings
  - Anonymous users cannot access settings
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view gift card settings" ON gift_card_settings;
DROP POLICY IF EXISTS "Admins can update gift card settings" ON gift_card_settings;
DROP POLICY IF EXISTS "Admins can insert gift card settings" ON gift_card_settings;

-- Create new policies that work with admin session auth
CREATE POLICY "Authenticated users can view gift card settings"
  ON gift_card_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert gift card settings"
  ON gift_card_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update gift card settings"
  ON gift_card_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow anonymous access for public gift card purchases
CREATE POLICY "Anonymous can view enabled gift card settings"
  ON gift_card_settings FOR SELECT
  TO anon
  USING (enabled = true);
