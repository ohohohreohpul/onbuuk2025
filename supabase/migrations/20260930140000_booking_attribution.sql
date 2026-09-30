/*
  # Booking attribution — where each booking came from

  Decided by Jev (docs/DECISIONS.md, 2026-09-30): build before the AI booking
  announcement so every early booking is attributed; show it on the main
  dashboard.

  channel values:
    ai_booked    booked directly by an AI assistant (AI booking form / agent API)
    ai_referral  customer clicked through from an AI answer (ChatGPT, Perplexity, …)
    search       Google, Bing, DuckDuckGo, …
    social       Instagram, Facebook, TikTok, …
    email        email campaign (utm_medium=email)
    referral     link from another website
    direct       typed address, bookmark, or no referrer
    admin        entered by staff in the admin
  NULL = booked before tracking existed.

  Idempotent: safe to re-run.
*/

BEGIN;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS channel text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS referrer_host text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ai_agent text;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_channel_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_channel_check CHECK (
  channel IS NULL OR channel IN ('ai_booked', 'ai_referral', 'search', 'social', 'email', 'referral', 'direct', 'admin')
);

CREATE INDEX IF NOT EXISTS idx_bookings_business_created_channel
  ON bookings(business_id, created_at, channel);

-- Backfill: agent bookings made before this migration.
UPDATE bookings b SET channel = 'ai_booked', ai_agent = ab.agent_name
  FROM agent_bookings ab
  WHERE ab.booking_id = b.id AND b.channel IS NULL;

COMMIT;
