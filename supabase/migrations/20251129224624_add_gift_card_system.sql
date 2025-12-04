/*
  # Add Gift Card System

  1. New Tables
    - `gift_card_settings`
      - `business_id` (uuid, primary key, references businesses)
      - `enabled` (boolean, default false)
      - `preset_amounts_cents` (integer array, e.g., [2500, 5000, 10000] for $25, $50, $100)
      - `allow_custom_amount` (boolean, default true)
      - `min_custom_amount_cents` (integer, default 1000 = $10)
      - `max_custom_amount_cents` (integer, default 50000 = $500)
      - `expiry_days` (integer, nullable - null means no expiry)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `gift_cards`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `code` (text, unique - generated code like "GC-XXXX-XXXX-XXXX")
      - `original_value_cents` (integer)
      - `current_balance_cents` (integer)
      - `status` (text: 'active', 'fully_redeemed', 'expired')
      - `purchased_by_customer_id` (uuid, references customers, nullable)
      - `purchased_for_email` (text, nullable - recipient email)
      - `purchased_at` (timestamptz)
      - `expires_at` (timestamptz, nullable)
      - `stripe_session_id` (text, nullable - for purchase tracking)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `gift_card_transactions`
      - `id` (uuid, primary key)
      - `gift_card_id` (uuid, references gift_cards)
      - `booking_id` (uuid, references bookings, nullable)
      - `amount_cents` (integer - positive for redemption, negative for refund)
      - `transaction_type` (text: 'purchase', 'redemption', 'refund')
      - `description` (text)
      - `created_at` (timestamptz)
      - `created_by` (text, nullable - for manual operations)

    - `customer_gift_cards`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `gift_card_id` (uuid, references gift_cards)
      - `claimed_at` (timestamptz)
      - UNIQUE(customer_id, gift_card_id)

  2. Security
    - Enable RLS on all tables
    - Admins can manage settings and view all gift cards
    - Customers can view their claimed gift cards
    - Anonymous users can purchase gift cards (via checkout)
    - Anyone with code can claim/redeem gift card

  3. Important Notes
    - Gift cards can be purchased without account (guest)
    - Buyer can enter recipient email to send gift card
    - Recipients can claim gift card by entering code
    - Gift cards can be partially redeemed
    - Expiry is optional and configurable per business
*/

-- Create gift_card_settings table
CREATE TABLE IF NOT EXISTS gift_card_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  preset_amounts_cents integer[] DEFAULT ARRAY[2500, 5000, 10000],
  allow_custom_amount boolean DEFAULT true,
  min_custom_amount_cents integer DEFAULT 1000 CHECK (min_custom_amount_cents > 0),
  max_custom_amount_cents integer DEFAULT 50000 CHECK (max_custom_amount_cents > min_custom_amount_cents),
  expiry_days integer CHECK (expiry_days IS NULL OR expiry_days > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create gift_cards table
CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  original_value_cents integer NOT NULL CHECK (original_value_cents > 0),
  current_balance_cents integer NOT NULL CHECK (current_balance_cents >= 0),
  status text DEFAULT 'active' CHECK (status IN ('active', 'fully_redeemed', 'expired')),
  purchased_by_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  purchased_for_email text,
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  stripe_session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create gift_card_transactions table
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'redemption', 'refund')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Create customer_gift_cards table (for claimed cards)
CREATE TABLE IF NOT EXISTS customer_gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  gift_card_id uuid NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  claimed_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, gift_card_id)
);

-- Enable RLS
ALTER TABLE gift_card_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_gift_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gift_card_settings (admin only)
CREATE POLICY "Admins can view gift card settings"
  ON gift_card_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = gift_card_settings.business_id
      AND admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update gift card settings"
  ON gift_card_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = gift_card_settings.business_id
      AND admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = gift_card_settings.business_id
      AND admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert gift card settings"
  ON gift_card_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = gift_card_settings.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- RLS Policies for gift_cards
CREATE POLICY "Anyone can view gift cards by code"
  ON gift_cards FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "System can insert gift cards"
  ON gift_cards FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "System can update gift cards"
  ON gift_cards FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete gift cards"
  ON gift_cards FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = gift_cards.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- RLS Policies for gift_card_transactions
CREATE POLICY "Customers can view transactions for their cards"
  ON gift_card_transactions FOR SELECT
  TO authenticated
  USING (
    gift_card_id IN (
      SELECT gift_card_id FROM customer_gift_cards
      WHERE customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM gift_cards gc
      JOIN admin_users a ON a.business_id = gc.business_id
      WHERE gc.id = gift_card_transactions.gift_card_id
      AND a.id = auth.uid()
    )
  );

CREATE POLICY "System can insert gift card transactions"
  ON gift_card_transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- RLS Policies for customer_gift_cards
CREATE POLICY "Customers can view their claimed cards"
  ON customer_gift_cards FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = customer_gift_cards.customer_id
      AND a.id = auth.uid()
    )
  );

CREATE POLICY "System can insert claimed cards"
  ON customer_gift_cards FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_business_id ON gift_cards(business_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card_id ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_booking_id ON gift_card_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_customer_gift_cards_customer_id ON customer_gift_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_gift_cards_gift_card_id ON customer_gift_cards(gift_card_id);

-- Function to generate unique gift card code
CREATE OR REPLACE FUNCTION generate_gift_card_code()
RETURNS text AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate format: GC-XXXX-XXXX-XXXX (alphanumeric, uppercase)
    new_code := 'GC-' || 
                substring(md5(random()::text || clock_timestamp()::text) from 1 for 4) ||
                '-' ||
                substring(md5(random()::text || clock_timestamp()::text) from 1 for 4) ||
                '-' ||
                substring(md5(random()::text || clock_timestamp()::text) from 1 for 4);
    new_code := upper(new_code);
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM gift_cards WHERE code = new_code) INTO code_exists;
    
    -- If unique, return it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update expired gift cards
CREATE OR REPLACE FUNCTION expire_gift_cards()
RETURNS void AS $$
BEGIN
  UPDATE gift_cards
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < now();
END;
$$ LANGUAGE plpgsql;