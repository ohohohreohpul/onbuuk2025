/*
  Internal end-to-end test business for the agent API (Jev decision:
  e2e_test_key = internal_test_key). Flagged is_internal_test, so it never
  appears in public agent search. Its agent key is business-scoped; only the
  SHA-256 hash is stored here — the plaintext lives in .env.local
  (ZENNO_TEST_AGENT_KEY) and is used by scripts/agent-e2e.mjs.
  Idempotent: fixed ids + ON CONFLICT DO NOTHING.
*/
BEGIN;

INSERT INTO businesses (id, name, subdomain, permalink, is_active, agent_enabled, agent_consent_policy,
                        vertical, city, agent_description, is_internal_test)
VALUES ('00000000-0000-4000-a000-00000000e2e0', 'Zenno Agent Test Salon', 'agent-e2e-lab', 'agent-e2e-lab',
        true, true, 'auto', 'salon', 'Hamburg', 'Internal end-to-end test business. Not a real salon.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO services (id, business_id, name, description, category)
VALUES ('00000000-0000-4000-a000-00000000e2e1', '00000000-0000-4000-a000-00000000e2e0',
        'Haircut', 'Wash, cut and style', 'Hair')
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_durations (id, business_id, service_id, duration_minutes, price_cents)
VALUES ('00000000-0000-4000-a000-00000000e2e2', '00000000-0000-4000-a000-00000000e2e0',
        '00000000-0000-4000-a000-00000000e2e1', 45, 4500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO specialists (id, business_id, name, is_active)
VALUES ('00000000-0000-4000-a000-00000000e2e3', '00000000-0000-4000-a000-00000000e2e0', 'Test Stylist', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO specialist_services (specialist_id, service_id, business_id)
VALUES ('00000000-0000-4000-a000-00000000e2e3', '00000000-0000-4000-a000-00000000e2e1',
        '00000000-0000-4000-a000-00000000e2e0')
ON CONFLICT (specialist_id, service_id) DO NOTHING;

INSERT INTO working_hours (business_id, specialist_id, day_of_week, start_time, end_time, is_available)
SELECT '00000000-0000-4000-a000-00000000e2e0', '00000000-0000-4000-a000-00000000e2e3', d, '09:00', '18:00', true
FROM generate_series(0, 6) AS d
ON CONFLICT (specialist_id, day_of_week) DO NOTHING;

INSERT INTO agent_api_keys (business_id, key_hash, key_prefix, label)
VALUES ('00000000-0000-4000-a000-00000000e2e0', 'b20f8115b194b3126ee49b9ccc224bb97a9c03ea0e5a80bd2da88c62e995c7a6', 'za_d0c132a', 'Zenno internal e2e')
ON CONFLICT (key_hash) DO NOTHING;

COMMIT;
