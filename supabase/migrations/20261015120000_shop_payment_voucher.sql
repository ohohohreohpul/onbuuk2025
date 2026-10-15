/*
  Gutschein at the counter without a Zenno code (paper vouchers): staff record
  method 'gift_card' with the amount and, optionally, the voucher number.
  Such rows have no gift_card_id and count towards the open amount like cash.
  (Vouchers redeemed through Zenno lower final_amount_cents instead.)
*/
DROP FUNCTION IF EXISTS public.record_shop_payment(uuid, text, integer);

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
  v_paid_in_shop integer;
  v_open integer;
BEGIN
  IF p_method NOT IN ('cash', 'card', 'gift_card', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method: %', p_method USING ERRCODE = '22023';
  END IF;
  -- 0 closes a booking that vouchers already cover in full.
  IF p_amount_cents IS NULL OR p_amount_cents < 0 THEN
    RAISE EXCEPTION 'The amount must not be negative' USING ERRCODE = '22023';
  END IF;

  SELECT id, business_id, COALESCE(final_amount_cents, 0) AS due
  INTO v_booking
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

  SELECT COALESCE(sum(amount_cents), 0) INTO v_paid_in_shop
  FROM public.booking_payments
  WHERE booking_id = p_booking_id
    AND (method IN ('cash', 'card', 'other') OR (method = 'gift_card' AND gift_card_id IS NULL));

  v_open := GREATEST(0, v_booking.due - v_paid_in_shop);
  IF v_open = 0 THEN
    UPDATE public.bookings SET payment_status = 'completed', updated_at = now() WHERE id = p_booking_id;
  END IF;

  RETURN jsonb_build_object('openCents', v_open);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_shop_payment(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_shop_payment(uuid, text, integer, text) TO authenticated;
