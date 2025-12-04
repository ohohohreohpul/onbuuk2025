/*
  # Add Gift Card Redemption and Promotional Code Tracking

  1. New Tables
    - `booking_gift_cards`
      - Links multiple gift cards to a single booking
      - Tracks amount used from each card
      - `id` (uuid, primary key)
      - `booking_id` (uuid, references bookings)
      - `gift_card_id` (uuid, references gift_cards)
      - `amount_used_cents` (integer - amount redeemed from this card)
      - `created_at` (timestamptz)

  2. Changes to Existing Tables
    - `bookings`
      - Add `promotional_code_used` (text, nullable - Stripe promo code)
      - Add `discount_amount_cents` (integer, default 0 - promo discount)
      - Add `gift_card_amount_cents` (integer, default 0 - total gift card redemption)
      - Add `final_amount_cents` (integer, nullable - actual amount charged)

  3. Security
    - Enable RLS on `booking_gift_cards`
    - Admins can view all booking gift card links for their business
    - Public can insert during booking creation
    - Customers can view their own booking gift card links

  4. Important Notes
    - Multiple gift cards can be applied to one booking
    - Gift card redemptions are tracked in both gift_card_transactions and booking_gift_cards
    - Promotional codes from Stripe are tracked for analytics
    - Final amount charged may be less than service price due to discounts
*/

-- Create booking_gift_cards junction table
CREATE TABLE IF NOT EXISTS booking_gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  gift_card_id uuid NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  amount_used_cents integer NOT NULL CHECK (amount_used_cents > 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(booking_id, gift_card_id)
);

-- Add promotional code and discount tracking to bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'promotional_code_used'
  ) THEN
    ALTER TABLE bookings ADD COLUMN promotional_code_used text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'discount_amount_cents'
  ) THEN
    ALTER TABLE bookings ADD COLUMN discount_amount_cents integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'gift_card_amount_cents'
  ) THEN
    ALTER TABLE bookings ADD COLUMN gift_card_amount_cents integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'final_amount_cents'
  ) THEN
    ALTER TABLE bookings ADD COLUMN final_amount_cents integer;
  END IF;
END $$;

-- Enable RLS on booking_gift_cards
ALTER TABLE booking_gift_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_gift_cards

-- Admins can view booking gift card links for their business
CREATE POLICY "Admins can view booking gift cards for their business"
  ON booking_gift_cards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN admin_users a ON a.business_id = b.business_id
      WHERE b.id = booking_gift_cards.booking_id
      AND a.id = auth.uid()
    )
  );

-- Public can insert during booking creation (system process)
CREATE POLICY "Public can insert booking gift cards"
  ON booking_gift_cards FOR INSERT
  TO public
  WITH CHECK (true);

-- Customers can view their own booking gift card links
CREATE POLICY "Customers can view their booking gift cards"
  ON booking_gift_cards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN customers c ON c.email = b.customer_email
      WHERE b.id = booking_gift_cards.booking_id
      AND c.user_id = auth.uid()
    )
  );

-- Anonymous users can view booking gift cards for public access
CREATE POLICY "Anonymous can view booking gift cards"
  ON booking_gift_cards FOR SELECT
  TO anon
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_gift_cards_booking_id ON booking_gift_cards(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_gift_cards_gift_card_id ON booking_gift_cards(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_bookings_promotional_code ON bookings(promotional_code_used) WHERE promotional_code_used IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_gift_card_amount ON bookings(gift_card_amount_cents) WHERE gift_card_amount_cents > 0;

-- Function to apply gift card to booking
CREATE OR REPLACE FUNCTION apply_gift_card_to_booking(
  p_booking_id uuid,
  p_gift_card_id uuid,
  p_amount_cents integer
)
RETURNS void AS $$
DECLARE
  v_gift_card gift_cards%ROWTYPE;
BEGIN
  -- Get and lock the gift card
  SELECT * INTO v_gift_card
  FROM gift_cards
  WHERE id = p_gift_card_id
  FOR UPDATE;

  -- Validate gift card has sufficient balance
  IF v_gift_card.current_balance_cents < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient gift card balance';
  END IF;

  -- Validate gift card is active
  IF v_gift_card.status != 'active' THEN
    RAISE EXCEPTION 'Gift card is not active';
  END IF;

  -- Check if expired
  IF v_gift_card.expires_at IS NOT NULL AND v_gift_card.expires_at < now() THEN
    RAISE EXCEPTION 'Gift card has expired';
  END IF;

  -- Create booking gift card link
  INSERT INTO booking_gift_cards (booking_id, gift_card_id, amount_used_cents)
  VALUES (p_booking_id, p_gift_card_id, p_amount_cents);

  -- Create transaction record
  INSERT INTO gift_card_transactions (
    gift_card_id,
    booking_id,
    amount_cents,
    transaction_type,
    description
  ) VALUES (
    p_gift_card_id,
    p_booking_id,
    p_amount_cents,
    'redemption',
    'Gift card redeemed for booking ' || p_booking_id
  );

  -- Update gift card balance
  UPDATE gift_cards
  SET
    current_balance_cents = current_balance_cents - p_amount_cents,
    status = CASE
      WHEN current_balance_cents - p_amount_cents = 0 THEN 'fully_redeemed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_gift_card_id;

  -- Update booking gift card amount
  UPDATE bookings
  SET gift_card_amount_cents = COALESCE(gift_card_amount_cents, 0) + p_amount_cents
  WHERE id = p_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
