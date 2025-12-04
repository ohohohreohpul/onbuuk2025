/*
  # Add Buffer Times to Services

  1. Schema Changes
    - Add `buffer_before` to services table (minutes before service)
    - Add `buffer_after` to services table (minutes after service)

  2. Purpose
    - Allow setup/cleanup time between appointments
    - Prevent back-to-back bookings without preparation time
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'buffer_before'
  ) THEN
    ALTER TABLE services ADD COLUMN buffer_before integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'buffer_after'
  ) THEN
    ALTER TABLE services ADD COLUMN buffer_after integer DEFAULT 0;
  END IF;
END $$;
