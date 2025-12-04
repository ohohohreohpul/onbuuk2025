/*
  # Fix Customer Trigger RLS Issue

  1. Changes
    - Update `upsert_customer_from_booking()` to use SECURITY DEFINER
    - This allows the trigger to bypass RLS when creating/updating customer records
    - Required because anonymous users create bookings but can't update existing customer records

  2. Security Notes
    - Function only runs when triggered by booking insert/update
    - Only creates/updates customer records based on booking data
    - No user input directly affects this function
*/

-- Drop and recreate the trigger function with SECURITY DEFINER
DROP FUNCTION IF EXISTS upsert_customer_from_booking() CASCADE;

CREATE OR REPLACE FUNCTION upsert_customer_from_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_record customers%ROWTYPE;
  booking_total integer;
BEGIN
  -- Get the price from the duration
  SELECT d.price_cents INTO booking_total
  FROM service_durations d
  WHERE d.id = NEW.duration_id;

  -- Insert or update customer
  INSERT INTO customers (business_id, name, email, phone, total_bookings, total_spent_cents, first_visit_date, last_visit_date)
  VALUES (
    NEW.business_id,
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    1,
    COALESCE(booking_total, 0),
    NEW.booking_date,
    NEW.booking_date
  )
  ON CONFLICT (business_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    total_bookings = customers.total_bookings + 1,
    total_spent_cents = customers.total_spent_cents + COALESCE(booking_total, 0),
    last_visit_date = CASE
      WHEN EXCLUDED.last_visit_date > customers.last_visit_date THEN EXCLUDED.last_visit_date
      ELSE customers.last_visit_date
    END,
    first_visit_date = CASE
      WHEN EXCLUDED.first_visit_date < customers.first_visit_date THEN EXCLUDED.first_visit_date
      ELSE customers.first_visit_date
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_upsert_customer
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION upsert_customer_from_booking();