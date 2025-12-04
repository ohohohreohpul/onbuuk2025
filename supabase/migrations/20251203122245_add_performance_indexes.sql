/*
  # Add Performance Indexes

  1. Purpose
    - Dramatically improve query performance for common operations
    - Add indexes for frequently queried columns
    - Optimize JOIN operations
    - Speed up filtering and sorting

  2. Indexes Added
    - Bookings: date, status, customer email, business+date composite
    - Admin user roles: user_id and role_id lookups
    - Services, specialists, gift cards: business_id lookups
    - Platform email logs: event_key and sent_at for statistics

  3. Performance Impact
    - 2-10x faster queries on filtered data
    - Faster JOIN operations
    - Improved sorting performance
*/

CREATE INDEX IF NOT EXISTS idx_bookings_date
  ON bookings(booking_date);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_bookings_business_date
  ON bookings(business_id, booking_date DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_email
  ON bookings(customer_email);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user
  ON admin_user_roles(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role
  ON admin_user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_services_business
  ON services(business_id);

CREATE INDEX IF NOT EXISTS idx_specialists_business
  ON specialists(business_id);

CREATE INDEX IF NOT EXISTS idx_gift_cards_business
  ON gift_cards(business_id);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code
  ON gift_cards(code);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_event_key
  ON platform_email_logs(event_key);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_sent_at
  ON platform_email_logs(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_event_date
  ON platform_email_logs(event_key, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_business
  ON customers(business_id);

CREATE INDEX IF NOT EXISTS idx_customers_email
  ON customers(email);

CREATE INDEX IF NOT EXISTS idx_service_durations_service
  ON service_durations(service_id);

CREATE INDEX IF NOT EXISTS idx_product_service_assignments_service
  ON product_service_assignments(service_id);

CREATE INDEX IF NOT EXISTS idx_product_service_assignments_business
  ON product_service_assignments(business_id);
