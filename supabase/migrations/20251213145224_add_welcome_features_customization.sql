/*
  # Add Welcome Features Customization

  1. New Tables
    - `welcome_feature_cards`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `card_order` (integer, for sorting)
      - `icon_type` (text, either 'lucide' or 'custom')
      - `icon_name` (text, Lucide icon name if icon_type is 'lucide')
      - `icon_url` (text, custom icon image URL if icon_type is 'custom')
      - `title` (text, card title)
      - `description` (text, card description)
      - `is_enabled` (boolean, toggle individual cards)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to businesses table
    - `show_welcome_features` (boolean, toggle entire section on/off)
    - `welcome_custom_html` (text, optional custom HTML)
    - `use_custom_welcome_html` (boolean, toggle between cards and custom HTML)

  3. Security
    - Enable RLS on welcome_feature_cards table
    - Add policies for business admins to manage their cards
    - Add policies for public read access to enabled cards
*/

-- Add new columns to businesses table
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS show_welcome_features boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_custom_html text,
  ADD COLUMN IF NOT EXISTS use_custom_welcome_html boolean DEFAULT false;

-- Create welcome_feature_cards table
CREATE TABLE IF NOT EXISTS welcome_feature_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  card_order integer NOT NULL DEFAULT 0,
  icon_type text NOT NULL DEFAULT 'lucide' CHECK (icon_type IN ('lucide', 'custom')),
  icon_name text,
  icon_url text,
  title text NOT NULL,
  description text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_icon_config CHECK (
    (icon_type = 'lucide' AND icon_name IS NOT NULL) OR
    (icon_type = 'custom' AND icon_url IS NOT NULL)
  )
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_welcome_cards_business_order
  ON welcome_feature_cards(business_id, card_order)
  WHERE is_enabled = true;

-- Enable RLS
ALTER TABLE welcome_feature_cards ENABLE ROW LEVEL SECURITY;

-- Public can view enabled cards
CREATE POLICY "Anyone can view enabled welcome cards"
  ON welcome_feature_cards FOR SELECT
  USING (is_enabled = true);

-- Business admins can view all their cards
CREATE POLICY "Business admins can view their welcome cards"
  ON welcome_feature_cards FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = auth.jwt()->>'email' OR user_id = auth.uid())
      AND is_active = true
    )
    OR is_super_admin()
  );

-- Business admins can insert their cards
CREATE POLICY "Business admins can create welcome cards"
  ON welcome_feature_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = auth.jwt()->>'email' OR user_id = auth.uid())
      AND is_active = true
      AND role IN ('owner', 'admin')
    )
    OR is_super_admin()
  );

-- Business admins can update their cards
CREATE POLICY "Business admins can update their welcome cards"
  ON welcome_feature_cards FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = auth.jwt()->>'email' OR user_id = auth.uid())
      AND is_active = true
      AND role IN ('owner', 'admin')
    )
    OR is_super_admin()
  );

-- Business admins can delete their cards
CREATE POLICY "Business admins can delete their welcome cards"
  ON welcome_feature_cards FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = auth.jwt()->>'email' OR user_id = auth.uid())
      AND is_active = true
      AND role IN ('owner', 'admin')
    )
    OR is_super_admin()
  );

-- Insert default cards for existing businesses
INSERT INTO welcome_feature_cards (business_id, card_order, icon_type, icon_name, title, description, is_enabled)
SELECT
  id as business_id,
  1 as card_order,
  'lucide' as icon_type,
  'Check' as icon_name,
  'Professional Service' as title,
  'Our experienced team is dedicated to providing you with exceptional service.' as description,
  true as is_enabled
FROM businesses
WHERE NOT EXISTS (
  SELECT 1 FROM welcome_feature_cards WHERE welcome_feature_cards.business_id = businesses.id
);

INSERT INTO welcome_feature_cards (business_id, card_order, icon_type, icon_name, title, description, is_enabled)
SELECT
  id as business_id,
  2 as card_order,
  'lucide' as icon_type,
  'Clock' as icon_name,
  'Flexible Scheduling' as title,
  'Choose the time that works best for you with our easy online booking system.' as description,
  true as is_enabled
FROM businesses
WHERE NOT EXISTS (
  SELECT 1 FROM welcome_feature_cards
  WHERE welcome_feature_cards.business_id = businesses.id
  AND welcome_feature_cards.card_order = 2
);

INSERT INTO welcome_feature_cards (business_id, card_order, icon_type, icon_name, title, description, is_enabled)
SELECT
  id as business_id,
  3 as card_order,
  'lucide' as icon_type,
  'CheckCircle2' as icon_name,
  'Easy Process' as title,
  'Simple and straightforward booking in just a few steps. Confirmation sent instantly.' as description,
  true as is_enabled
FROM businesses
WHERE NOT EXISTS (
  SELECT 1 FROM welcome_feature_cards
  WHERE welcome_feature_cards.business_id = businesses.id
  AND welcome_feature_cards.card_order = 3
);
