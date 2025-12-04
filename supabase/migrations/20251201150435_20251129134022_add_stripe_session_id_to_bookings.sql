/*
  # Add Stripe Session ID to Bookings

  1. Updates to Existing Tables
    - Add `stripe_session_id` column to bookings table to track Stripe checkout sessions

  2. Notes
    - This field will be populated by the webhook when payment is completed
    - Used to reference the specific Stripe checkout session for each booking
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'stripe_session_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN stripe_session_id text;
  END IF;
END $$;