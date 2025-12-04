/*
  # Add reminder_sent tracking to bookings

  1. Changes
    - Add `reminder_sent` boolean column to bookings table
    - Defaults to false for new bookings
    - Prevents duplicate reminder emails from being sent

  2. Notes
    - This column is used by the send-booking-reminders Edge Function
    - Bookings marked as reminder_sent won't receive additional reminders
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'reminder_sent'
  ) THEN
    ALTER TABLE bookings ADD COLUMN reminder_sent boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_pending 
  ON bookings(booking_date, status) 
  WHERE reminder_sent = false;
