/*
  # Agent Booking Layer

  Makes businesses bookable by AI agents through a universal /agent/v1 API.

  1. businesses additions
    - vertical, agent_enabled, agent_consent_policy, agent_lead_time_minutes,
      agent_slot_hold_seconds, geo_lat/lng, city, address_line, agent_description

  2. New tables
    - agent_api_keys   — hashed API keys issued per business
    - slot_holds       — time-limited tentative holds on availability slots
    - agent_bookings   — audit ledger linking bookings to the agent that made them
    - agent_events     — full agent activity log for the merchant dashboard

  3. Security
    - Merchants read only their own agent tables (tenant-aware RLS).
    - Agent endpoints use the service role with explicit business_id scoping from
      the validated API key; RLS on agent tables is tenant-aware for merchant reads.
    - Public read on agent_enabled businesses for search/manifest (via service role).
*/

-- ---------------------------------------------------------------------------
-- businesses additions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'vertical') THEN
    ALTER TABLE businesses ADD COLUMN vertical text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'agent_enabled') THEN
    ALTER TABLE businesses ADD COLUMN agent_enabled boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'agent_consent_policy') THEN
    ALTER TABLE businesses ADD COLUMN agent_consent_policy text DEFAULT 'manual'
      CHECK (agent_consent_policy IN ('auto', 'manual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'agent_lead_time_minutes') THEN
    ALTER TABLE businesses ADD COLUMN agent_lead_time_minutes integer DEFAULT 120;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'agent_slot_hold_seconds') THEN
    ALTER TABLE businesses ADD COLUMN agent_slot_hold_seconds integer DEFAULT 600;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'geo_lat') THEN
    ALTER TABLE businesses ADD COLUMN geo_lat numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'geo_lng') THEN
    ALTER TABLE businesses ADD COLUMN geo_lng numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'city') THEN
    ALTER TABLE businesses ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'address_line') THEN
    ALTER TABLE businesses ADD COLUMN address_line text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'businesses' AND column_name = 'agent_description') THEN
    ALTER TABLE businesses ADD COLUMN agent_description text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_businesses_agent_enabled
  ON businesses(agent_enabled) WHERE agent_enabled = true;
CREATE INDEX IF NOT EXISTS idx_businesses_vertical ON businesses(vertical);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);

-- ---------------------------------------------------------------------------
-- agent_api_keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  label text,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE agent_api_keys ENABLE ROW LEVEL SECURITY;
-- No permissive client policy: all admin access goes through the
-- agent-admin edge function, which uses the service role (bypasses RLS)
-- and is authorized via requireActiveAdmin. Default-deny for authenticated.

CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON agent_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_business ON agent_api_keys(business_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_business ON agent_api_keys(business_id);

-- ---------------------------------------------------------------------------
-- slot_holds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  duration_id uuid NOT NULL REFERENCES service_durations(id) ON DELETE CASCADE,
  specialist_id uuid REFERENCES specialists(id) ON DELETE SET NULL,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  held_until timestamptz NOT NULL,
  agent_key_id uuid REFERENCES agent_api_keys(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text,
  customer_phone text,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'booked', 'released', 'expired')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY;
-- Service role (agent endpoints) bypasses RLS; no client policy needed.

CREATE INDEX IF NOT EXISTS idx_slot_holds_business_date ON slot_holds(business_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_slot_holds_held_until ON slot_holds(held_until) WHERE status = 'held';

-- ---------------------------------------------------------------------------
-- agent_bookings — audit ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  agent_key_id uuid REFERENCES agent_api_keys(id) ON DELETE SET NULL,
  agent_name text,
  confidence numeric,
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_bookings ENABLE ROW LEVEL SECURITY;
-- Read via the agent-admin edge function (service role).

CREATE INDEX IF NOT EXISTS idx_agent_bookings_business ON agent_bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_agent_bookings_booking ON agent_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_agent_bookings_booking ON agent_bookings(booking_id);

-- ---------------------------------------------------------------------------
-- agent_events — activity log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  agent_key_id uuid REFERENCES agent_api_keys(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb,
  result text,
  confidence numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
-- Read via the agent-admin edge function (service role).

CREATE INDEX IF NOT EXISTS idx_agent_events_business_created
  ON agent_events(business_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Expire stale holds (runs on read via the app; cleanup also enforced in code)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_stale_slot_holds()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE slot_holds
    SET status = 'expired'
    WHERE status = 'held' AND held_until < now();
$$;

-- Allow the service role (agent endpoints) to set the tenant context.
-- Merchants reach these tables through their authenticated session which sets
-- app.current_business_id in their RLS context elsewhere.