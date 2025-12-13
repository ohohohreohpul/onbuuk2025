/*
  # Add Critical Performance Indexes

  1. Purpose
    - Dramatically improve query performance across admin views
    - Reduce query times from seconds to milliseconds
    - Fix OAuth callback timeouts by speeding up business lookups

  2. New Indexes
    - `bookings(business_id, booking_date)` - Speeds up BookingsView and CalendarView
    - `businesses(permalink)` - Speeds up tenant lookup by permalink
    - `customers(business_id, email)` - Speeds up customer lookups
    - `services(business_id)` - Speeds up service listings
    - `specialists(business_id, is_active)` - Speeds up specialist listings
    - `service_durations(service_id)` - Speeds up service duration lookups
    - `booking_form_colors(business_id)` - Speeds up theme customization
    - `site_settings(business_id)` - Speeds up settings queries

  3. Performance Impact
    - Queries filtering by business_id will use indexes instead of sequential scans
    - Reduces load on database significantly
    - Improves user experience with faster page loads
*/

-- Bookings table indexes
CREATE INDEX IF NOT EXISTS idx_bookings_business_date
  ON bookings(business_id, booking_date DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_business_status
  ON bookings(business_id, status);

-- Businesses table indexes
CREATE INDEX IF NOT EXISTS idx_businesses_permalink
  ON businesses(permalink);

CREATE INDEX IF NOT EXISTS idx_businesses_owner
  ON businesses(owner_id);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_business_email
  ON customers(business_id, email);

-- Services table indexes
CREATE INDEX IF NOT EXISTS idx_services_business
  ON services(business_id);

-- Specialists table indexes
CREATE INDEX IF NOT EXISTS idx_specialists_business_active
  ON specialists(business_id, is_active);

-- Service durations table indexes
CREATE INDEX IF NOT EXISTS idx_service_durations_service
  ON service_durations(service_id);

-- Booking form colors table indexes
CREATE INDEX IF NOT EXISTS idx_booking_form_colors_business
  ON booking_form_colors(business_id);

-- Site settings table indexes
CREATE INDEX IF NOT EXISTS idx_site_settings_business
  ON site_settings(business_id);

-- Admin users table indexes (for faster OAuth lookups)
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id
  ON admin_users(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_email_active
  ON admin_users(email, is_active)
  WHERE is_active = true;

-- Gift cards table indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_business
  ON gift_cards(business_id);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code
  ON gift_cards(code)
  WHERE status = 'active';

-- Loyalty points table indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer
  ON loyalty_points(customer_id, created_at DESC);

-- No show fees table indexes
CREATE INDEX IF NOT EXISTS idx_no_show_fees_booking
  ON no_show_fees(booking_id);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_business_active
  ON products(business_id, is_active)
  WHERE is_active = true;