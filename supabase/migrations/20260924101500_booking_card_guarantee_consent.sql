/*
  Preserve an auditable snapshot of the policy a customer accepted before
  Zenno stores a card for a possible no-show or late-cancellation charge.

  The fee and currency are copied onto the booking so later changes to a
  service or business setting cannot silently alter the accepted terms.
*/

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS card_guarantee_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_guarantee_policy_version text,
  ADD COLUMN IF NOT EXISTS card_guarantee_fee_cents integer,
  ADD COLUMN IF NOT EXISTS card_guarantee_late_cancel_hours integer,
  ADD COLUMN IF NOT EXISTS card_guarantee_currency text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_card_guarantee_fee_nonnegative,
  ADD CONSTRAINT bookings_card_guarantee_fee_nonnegative
    CHECK (card_guarantee_fee_cents IS NULL OR card_guarantee_fee_cents >= 0),
  DROP CONSTRAINT IF EXISTS bookings_card_guarantee_currency_format,
  ADD CONSTRAINT bookings_card_guarantee_currency_format
    CHECK (card_guarantee_currency IS NULL OR card_guarantee_currency ~ '^[A-Z]{3}$');

COMMENT ON COLUMN public.bookings.card_guarantee_consent_at
  IS 'When the customer explicitly accepted the card-guarantee policy.';
COMMENT ON COLUMN public.bookings.card_guarantee_policy_version
  IS 'Version of the no-show / late-cancellation policy shown at consent.';
COMMENT ON COLUMN public.bookings.card_guarantee_fee_cents
  IS 'No-show fee accepted by the customer, snapshotted in minor currency units.';
COMMENT ON COLUMN public.bookings.card_guarantee_late_cancel_hours
  IS 'Late-cancellation window accepted by the customer, in hours.';
COMMENT ON COLUMN public.bookings.card_guarantee_currency
  IS 'ISO 4217 currency code accepted with the card-guarantee policy.';
