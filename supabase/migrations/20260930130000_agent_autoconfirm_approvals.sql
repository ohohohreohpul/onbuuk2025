/*
  # Agent layer v1.1 — auto-confirm default, approval links, internal test flag

  Decided by Jev (see docs/DECISIONS.md, 2026-09-30):
    - default_consent = auto: new businesses auto-confirm agent bookings.
    - merchant_notification = email_only with a one-tap approve link, backed by
      an unguessable approval_token on agent_bookings.
    - e2e_test_key = internal_test_key: internal test businesses are flagged
      and never appear in public agent search.

  Idempotent: safe to re-run.
*/

BEGIN;

ALTER TABLE businesses ALTER COLUMN agent_consent_policy SET DEFAULT 'auto';
-- Businesses that have not turned agent booking on yet get the new default.
UPDATE businesses SET agent_consent_policy = 'auto'
  WHERE agent_enabled IS NOT TRUE AND agent_consent_policy = 'manual';

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_internal_test boolean DEFAULT false;

ALTER TABLE agent_bookings
  ADD COLUMN IF NOT EXISTS approval_token uuid DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_bookings_approval_token
  ON agent_bookings(approval_token);

COMMIT;
