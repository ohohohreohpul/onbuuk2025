-- Save the card used at checkout so a no-show / late-cancel fee can be charged
-- off-session (Treatwell-style card guarantee).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;

-- Index so we can look up repeat offenders by card quickly if needed
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_customer ON bookings(stripe_customer_id);

COMMENT ON COLUMN bookings.stripe_customer_id IS 'Stripe customer id captured during checkout (setup_future_usage=off_session)';
COMMENT ON COLUMN bookings.stripe_payment_method_id IS 'Card used at checkout — chargeable off-session for no-show/late-cancel fees';
