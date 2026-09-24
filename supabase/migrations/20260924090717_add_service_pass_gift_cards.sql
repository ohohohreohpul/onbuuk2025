/*
  # Service-specific gift-card passes

  Gift cards now have two deliberately separate models:

  - `value`: a monetary balance that can be used against any booking.
  - `service_pass`: a fixed number of visits for one service and duration. The
    package sale price is recorded independently from the value of each visit.

  One service-pass visit covers one standard service unit. Add-ons and the
  second service unit in a pair booking remain payable.
*/

CREATE TABLE public.service_pass_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description text,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  duration_id uuid NOT NULL REFERENCES public.service_durations(id) ON DELETE RESTRICT,
  visit_count integer NOT NULL CHECK (visit_count BETWEEN 1 AND 100),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  expiry_days integer CHECK (expiry_days IS NULL OR expiry_days > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_pass_offers_business_active_idx
  ON public.service_pass_offers (business_id, is_active);

CREATE INDEX service_pass_offers_service_duration_idx
  ON public.service_pass_offers (service_id, duration_id);

ALTER TABLE public.service_pass_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active service pass offers"
  ON public.service_pass_offers
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view own service pass offers"
  ON public.service_pass_offers
  FOR SELECT
  TO authenticated
  USING (business_id = public.get_admin_business_id());

CREATE POLICY "Admins can create own service pass offers"
  ON public.service_pass_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id = public.get_admin_business_id());

CREATE POLICY "Admins can update own service pass offers"
  ON public.service_pass_offers
  FOR UPDATE
  TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (business_id = public.get_admin_business_id());

CREATE POLICY "Admins can delete own service pass offers"
  ON public.service_pass_offers
  FOR DELETE
  TO authenticated
  USING (business_id = public.get_admin_business_id());

-- Tables created in SQL are not automatically exposed to the Data API on new
-- Supabase projects, so privileges are explicit as well as RLS-scoped.
GRANT SELECT ON TABLE public.service_pass_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_pass_offers TO authenticated;
GRANT ALL ON TABLE public.service_pass_offers TO service_role;

CREATE OR REPLACE FUNCTION public.validate_service_pass_offer_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_service_business_id uuid;
  v_duration_service_id uuid;
  v_duration_business_id uuid;
BEGIN
  SELECT service.business_id
  INTO v_service_business_id
  FROM public.services AS service
  WHERE service.id = NEW.service_id;

  SELECT duration.service_id, duration.business_id
  INTO v_duration_service_id, v_duration_business_id
  FROM public.service_durations AS duration
  WHERE duration.id = NEW.duration_id;

  IF v_service_business_id IS DISTINCT FROM NEW.business_id THEN
    RAISE EXCEPTION 'The selected service does not belong to this business';
  END IF;

  IF v_duration_service_id IS DISTINCT FROM NEW.service_id
     OR v_duration_business_id IS DISTINCT FROM NEW.business_id THEN
    RAISE EXCEPTION 'The selected duration does not belong to this service';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_service_pass_offer_scope_before_write
  BEFORE INSERT OR UPDATE ON public.service_pass_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_service_pass_offer_scope();

REVOKE ALL ON FUNCTION public.validate_service_pass_offer_scope() FROM PUBLIC;

ALTER TABLE public.gift_cards
  ADD COLUMN card_type text NOT NULL DEFAULT 'value'
    CHECK (card_type IN ('value', 'service_pass')),
  ADD COLUMN service_pass_offer_id uuid
    REFERENCES public.service_pass_offers(id) ON DELETE SET NULL,
  ADD COLUMN service_pass_name text,
  ADD COLUMN service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT,
  ADD COLUMN duration_id uuid REFERENCES public.service_durations(id) ON DELETE RESTRICT,
  ADD COLUMN original_visits integer,
  ADD COLUMN remaining_visits integer,
  ADD COLUMN purchase_price_cents integer NOT NULL DEFAULT 0;

UPDATE public.gift_cards
SET purchase_price_cents = original_value_cents
WHERE card_type = 'value' AND purchase_price_cents = 0;

ALTER TABLE public.gift_cards
  DROP CONSTRAINT IF EXISTS gift_cards_original_value_cents_check;

ALTER TABLE public.gift_cards
  ADD CONSTRAINT gift_cards_value_or_service_pass_check CHECK (
    (
      card_type = 'value'
      AND original_value_cents > 0
      AND current_balance_cents >= 0
      AND service_id IS NULL
      AND duration_id IS NULL
      AND original_visits IS NULL
      AND remaining_visits IS NULL
      AND purchase_price_cents >= 0
    )
    OR
    (
      card_type = 'service_pass'
      AND original_value_cents = 0
      AND current_balance_cents = 0
      AND purchase_price_cents > 0
      AND service_id IS NOT NULL
      AND duration_id IS NOT NULL
      AND service_pass_name IS NOT NULL
      AND length(btrim(service_pass_name)) > 0
      AND original_visits > 0
      AND remaining_visits BETWEEN 0 AND original_visits
    )
  );

CREATE INDEX gift_cards_service_pass_offer_idx
  ON public.gift_cards (service_pass_offer_id)
  WHERE card_type = 'service_pass';

CREATE INDEX gift_cards_service_pass_entitlement_idx
  ON public.gift_cards (business_id, service_id, duration_id)
  WHERE card_type = 'service_pass' AND status = 'active';

ALTER TABLE public.gift_card_transactions
  ADD COLUMN visit_count integer NOT NULL DEFAULT 0
    CHECK (visit_count >= 0);

ALTER TABLE public.booking_gift_cards
  ADD COLUMN redemption_type text NOT NULL DEFAULT 'value'
    CHECK (redemption_type IN ('value', 'service_pass')),
  ADD COLUMN visits_used integer NOT NULL DEFAULT 0
    CHECK (visits_used >= 0);

COMMENT ON COLUMN public.gift_cards.purchase_price_cents IS
  'What the customer paid. For service passes this is intentionally independent of the service value covered at redemption.';
COMMENT ON COLUMN public.gift_cards.remaining_visits IS
  'Remaining service entitlements for service-pass cards; null for monetary value cards.';
COMMENT ON COLUMN public.booking_gift_cards.amount_used_cents IS
  'Booking price covered. For service passes this is the entitled service unit price, not a decrementing cash balance.';

-- Safe, minimal preview used by the public booking checkout. It returns only
-- the information needed to display and price one redemption.
CREATE OR REPLACE FUNCTION public.preview_gift_card_for_booking(
  p_business_id uuid,
  p_code text,
  p_service_id uuid,
  p_duration_id uuid,
  p_remaining_total_cents integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card record;
  v_duration record;
  v_discount_cents integer;
BEGIN
  IF p_remaining_total_cents <= 0 THEN
    RAISE EXCEPTION 'The booking is already fully covered';
  END IF;

  SELECT
    card.id,
    card.code,
    card.card_type,
    card.status,
    card.expires_at,
    card.current_balance_cents,
    card.service_id,
    card.duration_id,
    card.service_pass_name,
    card.remaining_visits
  INTO v_card
  FROM public.gift_cards AS card
  WHERE card.business_id = p_business_id
    AND upper(card.code) = upper(btrim(p_code));

  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'Invalid gift card or pass code';
  END IF;

  IF v_card.status <> 'active' THEN
    RAISE EXCEPTION 'This gift card or pass is no longer active';
  END IF;

  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    RAISE EXCEPTION 'This gift card or pass has expired';
  END IF;

  IF v_card.card_type = 'value' THEN
    IF v_card.current_balance_cents <= 0 THEN
      RAISE EXCEPTION 'This gift card has no remaining balance';
    END IF;

    v_discount_cents := LEAST(v_card.current_balance_cents, p_remaining_total_cents);

    RETURN jsonb_build_object(
      'id', v_card.id,
      'code', v_card.code,
      'cardType', 'value',
      'amountUsedCents', v_discount_cents,
      'remainingBalanceCents', v_card.current_balance_cents - v_discount_cents
    );
  END IF;

  IF v_card.service_id IS DISTINCT FROM p_service_id
     OR v_card.duration_id IS DISTINCT FROM p_duration_id THEN
    RAISE EXCEPTION 'This pass is only valid for a different service or duration';
  END IF;

  IF COALESCE(v_card.remaining_visits, 0) <= 0 THEN
    RAISE EXCEPTION 'This service pass has no visits remaining';
  END IF;

  SELECT duration.price_cents, duration.duration_minutes
  INTO v_duration
  FROM public.service_durations AS duration
  WHERE duration.id = p_duration_id
    AND duration.service_id = p_service_id
    AND duration.business_id = p_business_id;

  IF v_duration.price_cents IS NULL THEN
    RAISE EXCEPTION 'The booking duration could not be verified';
  END IF;

  v_discount_cents := LEAST(v_duration.price_cents, p_remaining_total_cents);

  RETURN jsonb_build_object(
    'id', v_card.id,
    'code', v_card.code,
    'cardType', 'service_pass',
    'amountUsedCents', v_discount_cents,
    'remainingBalanceCents', 0,
    'servicePassName', v_card.service_pass_name,
    'remainingVisits', v_card.remaining_visits - 1,
    'durationMinutes', v_duration.duration_minutes
  );
END;
$$;

-- Redemption is atomic: the card/pass is locked, entitlement is revalidated,
-- the booking link and audit transaction are inserted, and both remaining
-- entitlement and booking totals are updated in one transaction.
CREATE OR REPLACE FUNCTION public.redeem_gift_card_for_booking(
  p_booking_id uuid,
  p_code text,
  p_requested_amount_cents integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking record;
  v_card record;
  v_duration record;
  v_amount_used integer;
  v_remaining_balance integer;
  v_remaining_visits integer;
BEGIN
  SELECT
    booking.id,
    booking.business_id,
    booking.service_id,
    booking.duration_id,
    COALESCE(booking.final_amount_cents, 0) AS final_amount_cents
  INTO v_booking
  FROM public.bookings AS booking
  WHERE booking.id = p_booking_id
  FOR UPDATE;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.final_amount_cents <= 0 THEN
    RAISE EXCEPTION 'The booking is already fully covered';
  END IF;

  SELECT card.*
  INTO v_card
  FROM public.gift_cards AS card
  WHERE card.business_id = v_booking.business_id
    AND upper(card.code) = upper(btrim(p_code))
  FOR UPDATE;

  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'Invalid gift card or pass code';
  END IF;

  IF v_card.status <> 'active' THEN
    RAISE EXCEPTION 'This gift card or pass is no longer active';
  END IF;

  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    RAISE EXCEPTION 'This gift card or pass has expired';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_gift_cards AS applied
    WHERE applied.booking_id = p_booking_id
      AND applied.gift_card_id = v_card.id
  ) THEN
    RAISE EXCEPTION 'This gift card or pass is already applied to the booking';
  END IF;

  IF v_card.card_type = 'value' THEN
    IF p_requested_amount_cents IS NULL OR p_requested_amount_cents <= 0 THEN
      RAISE EXCEPTION 'A positive redemption amount is required';
    END IF;

    IF v_card.current_balance_cents <= 0 THEN
      RAISE EXCEPTION 'This gift card has no remaining balance';
    END IF;

    v_amount_used := LEAST(
      p_requested_amount_cents,
      v_card.current_balance_cents,
      v_booking.final_amount_cents
    );
    v_remaining_balance := v_card.current_balance_cents - v_amount_used;
    v_remaining_visits := NULL;

    UPDATE public.gift_cards
    SET current_balance_cents = v_remaining_balance,
        status = CASE WHEN v_remaining_balance = 0 THEN 'fully_redeemed' ELSE status END,
        updated_at = now()
    WHERE id = v_card.id;
  ELSE
    IF v_card.service_id IS DISTINCT FROM v_booking.service_id
       OR v_card.duration_id IS DISTINCT FROM v_booking.duration_id THEN
      RAISE EXCEPTION 'This pass is only valid for a different service or duration';
    END IF;

    IF COALESCE(v_card.remaining_visits, 0) <= 0 THEN
      RAISE EXCEPTION 'This service pass has no visits remaining';
    END IF;

    SELECT duration.price_cents
    INTO v_duration
    FROM public.service_durations AS duration
    WHERE duration.id = v_booking.duration_id
      AND duration.service_id = v_booking.service_id
      AND duration.business_id = v_booking.business_id;

    IF v_duration.price_cents IS NULL THEN
      RAISE EXCEPTION 'The booking duration could not be verified';
    END IF;

    -- One visit covers one standard service unit. A pair booking therefore
    -- still owes the second unit, and add-ons remain payable.
    v_amount_used := LEAST(v_duration.price_cents, v_booking.final_amount_cents);
    v_remaining_balance := 0;
    v_remaining_visits := v_card.remaining_visits - 1;

    UPDATE public.gift_cards
    SET remaining_visits = v_remaining_visits,
        status = CASE WHEN v_remaining_visits = 0 THEN 'fully_redeemed' ELSE status END,
        updated_at = now()
    WHERE id = v_card.id;
  END IF;

  INSERT INTO public.booking_gift_cards (
    booking_id,
    gift_card_id,
    amount_used_cents,
    redemption_type,
    visits_used
  ) VALUES (
    p_booking_id,
    v_card.id,
    v_amount_used,
    v_card.card_type,
    CASE WHEN v_card.card_type = 'service_pass' THEN 1 ELSE 0 END
  );

  INSERT INTO public.gift_card_transactions (
    gift_card_id,
    booking_id,
    amount_cents,
    visit_count,
    transaction_type,
    description
  ) VALUES (
    v_card.id,
    p_booking_id,
    v_amount_used,
    CASE WHEN v_card.card_type = 'service_pass' THEN 1 ELSE 0 END,
    'redemption',
    CASE
      WHEN v_card.card_type = 'service_pass'
        THEN 'Service-pass visit redeemed for booking ' || p_booking_id::text
      ELSE 'Gift-card value redeemed for booking ' || p_booking_id::text
    END
  );

  UPDATE public.bookings
  SET gift_card_amount_cents = COALESCE(gift_card_amount_cents, 0) + v_amount_used,
      final_amount_cents = GREATEST(0, COALESCE(final_amount_cents, 0) - v_amount_used),
      updated_at = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'cardType', v_card.card_type,
    'amountUsedCents', v_amount_used,
    'remainingBalanceCents', v_remaining_balance,
    'remainingVisits', v_remaining_visits,
    'bookingFinalAmountCents', GREATEST(0, v_booking.final_amount_cents - v_amount_used)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_service_pass_at_pos(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_id uuid;
  v_card record;
  v_covered_value integer;
  v_remaining_visits integer;
BEGIN
  v_business_id := public.get_admin_business_id();
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'An authenticated business owner or team member is required';
  END IF;

  SELECT card.*
  INTO v_card
  FROM public.gift_cards AS card
  WHERE card.business_id = v_business_id
    AND upper(card.code) = upper(btrim(p_code))
  FOR UPDATE;

  IF v_card.id IS NULL OR v_card.card_type <> 'service_pass' THEN
    RAISE EXCEPTION 'Service pass not found';
  END IF;
  IF v_card.status <> 'active' THEN
    RAISE EXCEPTION 'This service pass is no longer active';
  END IF;
  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    RAISE EXCEPTION 'This service pass has expired';
  END IF;
  IF COALESCE(v_card.remaining_visits, 0) <= 0 THEN
    RAISE EXCEPTION 'This service pass has no visits remaining';
  END IF;

  SELECT duration.price_cents
  INTO v_covered_value
  FROM public.service_durations AS duration
  WHERE duration.id = v_card.duration_id
    AND duration.service_id = v_card.service_id
    AND duration.business_id = v_business_id;

  IF v_covered_value IS NULL THEN
    RAISE EXCEPTION 'The pass service duration could not be verified';
  END IF;

  v_remaining_visits := v_card.remaining_visits - 1;

  UPDATE public.gift_cards
  SET remaining_visits = v_remaining_visits,
      status = CASE WHEN v_remaining_visits = 0 THEN 'fully_redeemed' ELSE status END,
      updated_at = now()
  WHERE id = v_card.id;

  INSERT INTO public.gift_card_transactions (
    gift_card_id,
    amount_cents,
    visit_count,
    transaction_type,
    description,
    created_by
  ) VALUES (
    v_card.id,
    v_covered_value,
    1,
    'redemption',
    'Service-pass visit redeemed at point of sale',
    auth.uid()::text
  );

  RETURN jsonb_build_object(
    'remainingVisits', v_remaining_visits,
    'amountUsedCents', v_covered_value,
    'status', CASE WHEN v_remaining_visits = 0 THEN 'fully_redeemed' ELSE 'active' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_gift_card_for_booking(uuid, text, uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_gift_card_for_booking(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_service_pass_at_pos(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_gift_card_for_booking(uuid, text, uuid, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card_for_booking(uuid, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_service_pass_at_pos(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_gift_card_for_booking(uuid, text, uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card_for_booking(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_service_pass_at_pos(text) TO service_role;

-- The original id-based function accepted arbitrary public redemptions and did
-- not validate business ownership. All booking clients now use the code-based,
-- scoped function above.
REVOKE ALL ON FUNCTION public.apply_gift_card_to_booking(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_gift_card_to_booking(uuid, uuid, integer) FROM anon, authenticated;
