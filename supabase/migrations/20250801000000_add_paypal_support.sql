-- Add PayPal order ID columns to bookings and gift_cards tables
-- This allows tracking PayPal payments alongside Stripe payments

-- Add paypal_order_id to bookings table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'paypal_order_id') THEN
    ALTER TABLE bookings ADD COLUMN paypal_order_id TEXT;
  END IF;
END $$;

-- Add paypal_order_id to gift_cards table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_cards' AND column_name = 'paypal_order_id') THEN
    ALTER TABLE gift_cards ADD COLUMN paypal_order_id TEXT;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_paypal_order_id ON bookings(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_cards_paypal_order_id ON gift_cards(paypal_order_id) WHERE paypal_order_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN bookings.paypal_order_id IS 'PayPal Order ID for payments made via PayPal';
COMMENT ON COLUMN gift_cards.paypal_order_id IS 'PayPal Order ID for gift cards purchased via PayPal';
