/*
  Undo for one-tap counter payments: whoever recorded a payment can take it back
  within 10 minutes (a mis-tap). Like corrections, nothing is deleted: the row is
  marked voided and the booking reopens. Later changes go through
  correct_shop_payment (owners/admins).
*/
CREATE OR REPLACE FUNCTION public.undo_shop_payment(p_payment_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_payment public.booking_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM public.booking_payments
  WHERE id = p_payment_id AND business_id = public.get_admin_business_id()
  FOR UPDATE;
  IF v_payment.id IS NULL OR v_payment.recorded_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = '42501';
  END IF;
  IF v_payment.voided_at IS NOT NULL THEN
    RETURN;
  END IF;
  IF v_payment.created_at < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Too late to undo; ask the owner to correct it' USING ERRCODE = '22023';
  END IF;

  UPDATE public.booking_payments SET voided_at = now(), voided_by = auth.uid() WHERE id = v_payment.id;
  PERFORM private.settle_booking_payment_status(v_payment.booking_id, true);
END;
$function$;

REVOKE ALL ON FUNCTION public.undo_shop_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_shop_payment(uuid) TO authenticated;

-- record_shop_payment returns the new payment's id so the screen can offer undo.
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
  v_payment_id uuid;
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
    VALUES (v_booking.business_id, p_booking_id, p_method, p_amount_cents, NULLIF(btrim(p_reference), ''), auth.uid())
    RETURNING id INTO v_payment_id;
  END IF;

  -- Adding money only ever closes a booking; reopening happens through corrections.
  SELECT private.settle_booking_payment_status(p_booking_id, false) INTO v_open;
  RETURN jsonb_build_object('openCents', v_open, 'paymentId', v_payment_id);
END;
$function$;
