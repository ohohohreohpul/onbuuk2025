/*
  # Add Feature Toggles to Businesses

  1. Changes
    - Add `enable_gift_cards` boolean column to businesses table
      - Controls whether gift card sales are enabled for this business
      - Default: true (enabled by default)

    - Add `enable_bookings` boolean column to businesses table
      - Controls whether booking services are enabled for this business
      - Default: true (enabled by default)

  2. Purpose
    - Allow businesses to individually control which features they want to offer
    - Gift card sales can be disabled if business doesn't want to sell gift cards
    - Booking services can be disabled if business only wants to sell gift cards
    - Both features can be independently enabled/disabled

  3. Security
    - No RLS changes needed - existing business policies cover these columns
*/

-- Add enable_gift_cards column to businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'enable_gift_cards'
  ) THEN
    ALTER TABLE businesses ADD COLUMN enable_gift_cards boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Add enable_bookings column to businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'enable_bookings'
  ) THEN
    ALTER TABLE businesses ADD COLUMN enable_bookings boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_feature_flags
  ON businesses(enable_gift_cards, enable_bookings);