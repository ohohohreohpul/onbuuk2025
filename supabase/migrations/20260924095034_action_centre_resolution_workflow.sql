/*
  Make the dashboard Action Centre a real workflow rather than a list of
  uncloseable alerts.

  No-show fees gain an explicit resolution state, while action-centre items
  can be snoozed for their current underlying set of records. If that set
  changes, the action automatically becomes visible again.
*/

ALTER TABLE public.no_show_fees
  ADD COLUMN IF NOT EXISTS resolution_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text;

UPDATE public.no_show_fees
SET paid = COALESCE(paid, false),
    resolution_status = CASE WHEN paid IS TRUE THEN 'paid' ELSE 'unpaid' END,
    paid_at = CASE WHEN paid THEN COALESCE(paid_at, charged_at, now()) ELSE NULL END,
    resolved_at = CASE WHEN paid THEN COALESCE(paid_at, charged_at, now()) ELSE NULL END;

ALTER TABLE public.no_show_fees
  DROP CONSTRAINT IF EXISTS no_show_fees_resolution_status_check,
  DROP CONSTRAINT IF EXISTS no_show_fees_resolution_consistency_check;

ALTER TABLE public.no_show_fees
  ADD CONSTRAINT no_show_fees_resolution_status_check
    CHECK (resolution_status IN ('unpaid', 'paid', 'waived')),
  ADD CONSTRAINT no_show_fees_resolution_consistency_check CHECK (
    (resolution_status = 'unpaid' AND paid = false AND paid_at IS NULL AND resolved_at IS NULL)
    OR
    (resolution_status = 'paid' AND paid = true AND paid_at IS NOT NULL AND resolved_at IS NOT NULL)
    OR
    (resolution_status = 'waived' AND paid = false AND paid_at IS NULL AND resolved_at IS NOT NULL)
  );

-- The charge function uses an idempotent upsert for a booking. Enforce that
-- invariant in the database as well.
CREATE UNIQUE INDEX IF NOT EXISTS no_show_fees_booking_unique_idx
  ON public.no_show_fees (booking_id);

CREATE INDEX IF NOT EXISTS no_show_fees_resolution_status_idx
  ON public.no_show_fees (resolution_status, charged_at DESC);

CREATE TABLE public.action_centre_snoozes (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  action_key text NOT NULL CHECK (length(btrim(action_key)) BETWEEN 1 AND 80),
  item_signature text NOT NULL CHECK (length(item_signature) > 0),
  snoozed_until timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, action_key)
);

CREATE INDEX action_centre_snoozes_expiry_idx
  ON public.action_centre_snoozes (business_id, snoozed_until);

ALTER TABLE public.action_centre_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own action centre snoozes"
  ON public.action_centre_snoozes
  FOR ALL
  TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (business_id = public.get_admin_business_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.action_centre_snoozes TO authenticated;
GRANT ALL ON TABLE public.action_centre_snoozes TO service_role;

COMMENT ON COLUMN public.no_show_fees.resolution_status IS
  'unpaid requires action; paid and waived are resolved and leave the Action Centre.';
COMMENT ON TABLE public.action_centre_snoozes IS
  'Per-business, signature-aware temporary hides for dashboard action groups.';
