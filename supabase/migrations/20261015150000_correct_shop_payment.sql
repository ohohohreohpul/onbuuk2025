DROP FUNCTION IF EXISTS private.settle_booking_payment_status(uuid);
/*
  Owners/admins can correct counter payments (wrong method or amount).
  GoBD: nothing is deleted. The old row is marked voided (who, when) and a new
  row holds the corrected values. Online payments and vouchers redeemed through
  Zenno are not editable here.
*/
ALTER TABLE public.booking_payments
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS replaced_by uuid REFERENCES public.booking_payments(id);

CREATE OR REPLACE FUNCTION private.settle_booking_payment_status(p_booking_id uuid, p_allow_reopen boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_due integer;
  v_paid integer;
  v_open integer;
BEGIN
  SELECT COALESCE(final_amount_cents, 0) INTO v_due FROM public.bookings WHERE id = p_booking_id;
  SELECT COALESCE(sum(amount_cents), 0) INTO v_paid
  FROM public.booking_payments
  WHERE booking_id = p_booking_id AND voided_at IS NULL
    -- Zenno voucher redemptions already lowered final_amount_cents; everything else pays it.
    AND (method IN ('cash', 'card', 'other', 'stripe', 'paypal') OR (method = 'gift_card' AND gift_card_id IS NULL));
  v_open := GREATEST(0, v_due - v_paid);
  IF v_open = 0 THEN
    UPDATE public.bookings SET payment_status = 'completed', updated_at = now()
     WHERE id = p_booking_id AND payment_status IS DISTINCT FROM 'completed';
  ELSIF p_allow_reopen THEN
    UPDATE public.bookings SET payment_status = 'pending', updated_at = now()
     WHERE id = p_booking_id AND payment_status = 'completed';
  END IF;
  RETURN v_open;
END;
$function$;

-- Counter payment, now ignoring voided rows.
CREATE OR REPLACE FUNCTION public.record_shop_payment(
  p_booking_id uuid, p_method text, p_amount_cents integer, p_reference text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_booking record;
  v_open integer;
BEGIN
  IF p_method NOT IN ('cash', 'card', 'gift_card', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method: %', p_method USING ERRCODE = '22023';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents < 0 THEN
    RAISE EXCEPTION 'The amount must not be negative' USING ERRCODE = '22023';
  END IF;

  SELECT id, business_id INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id AND business_id = public.get_admin_business_id()
  FOR UPDATE;
  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = '42501';
  END IF;

  IF p_amount_cents > 0 THEN
    INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, reference, recorded_by)
    VALUES (v_booking.business_id, p_booking_id, p_method, p_amount_cents, NULLIF(btrim(p_reference), ''), auth.uid());
  END IF;

  -- Adding money only ever closes a booking; reopening happens through corrections.
  SELECT private.settle_booking_payment_status(p_booking_id, false) INTO v_open;
  RETURN jsonb_build_object('openCents', v_open);
END;
$function$;

/*
  Correct a counter payment. p_amount_cents = 0 removes it (voided, no
  replacement). Only shop owners and admins.
*/
CREATE OR REPLACE FUNCTION public.correct_shop_payment(
  p_payment_id uuid, p_method text, p_amount_cents integer, p_reference text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_old public.booking_payments%ROWTYPE;
  v_new_id uuid;
  v_open integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active AND role IN ('owner', 'admin')
      AND business_id = public.get_admin_business_id()
  ) THEN
    RAISE EXCEPTION 'Only owners and admins can correct payments' USING ERRCODE = '42501';
  END IF;
  IF p_method NOT IN ('cash', 'card', 'gift_card', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method: %', p_method USING ERRCODE = '22023';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents < 0 THEN
    RAISE EXCEPTION 'The amount must not be negative' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.booking_payments
  WHERE id = p_payment_id AND business_id = public.get_admin_business_id()
  FOR UPDATE;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = '42501';
  END IF;
  IF v_old.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This payment was already corrected' USING ERRCODE = '22023';
  END IF;
  IF NOT (v_old.method IN ('cash', 'card', 'other') OR (v_old.method = 'gift_card' AND v_old.gift_card_id IS NULL)) THEN
    RAISE EXCEPTION 'Online payments and Zenno gift card redemptions cannot be edited' USING ERRCODE = '22023';
  END IF;

  IF p_amount_cents > 0 THEN
    INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, reference, recorded_by)
    VALUES (v_old.business_id, v_old.booking_id, p_method, p_amount_cents, NULLIF(btrim(p_reference), ''), auth.uid())
    RETURNING id INTO v_new_id;
  END IF;

  UPDATE public.booking_payments
     SET voided_at = now(), voided_by = auth.uid(), replaced_by = v_new_id
   WHERE id = v_old.id;

  SELECT private.settle_booking_payment_status(v_old.booking_id, true) INTO v_open;
  RETURN jsonb_build_object('openCents', v_open, 'newPaymentId', v_new_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.correct_shop_payment(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_shop_payment(uuid, text, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION private.settle_booking_payment_status(uuid, boolean) FROM PUBLIC, anon, authenticated;
