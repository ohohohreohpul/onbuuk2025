/*
  # Populate Customers from Existing Bookings

  1. What This Does
    - Finds all existing bookings in the database
    - Creates customer records for each unique email
    - Calculates total bookings and total spent
    - Sets first and last visit dates

  2. Important Notes
    - This is a one-time data migration
    - Runs safely with ON CONFLICT DO UPDATE
    - Future bookings will auto-create customers via trigger
*/

-- Populate customers table from existing bookings
INSERT INTO customers (
  business_id,
  name,
  email,
  phone,
  total_bookings,
  total_spent_cents,
  first_visit_date,
  last_visit_date,
  created_at,
  updated_at
)
SELECT
  b.business_id,
  MAX(b.customer_name) as name,
  b.customer_email as email,
  MAX(b.customer_phone) as phone,
  COUNT(*) as total_bookings,
  COALESCE(SUM(d.price_cents), 0) as total_spent_cents,
  MIN(b.booking_date) as first_visit_date,
  MAX(b.booking_date) as last_visit_date,
  MIN(b.created_at) as created_at,
  MAX(b.updated_at) as updated_at
FROM bookings b
LEFT JOIN service_durations d ON b.duration_id = d.id
GROUP BY b.business_id, b.customer_email
ON CONFLICT (business_id, email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = COALESCE(EXCLUDED.phone, customers.phone),
  total_bookings = EXCLUDED.total_bookings,
  total_spent_cents = EXCLUDED.total_spent_cents,
  first_visit_date = EXCLUDED.first_visit_date,
  last_visit_date = EXCLUDED.last_visit_date,
  updated_at = now();
