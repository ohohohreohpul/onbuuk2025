/*
  # Booking payments: how every booking was paid

  Shops need to show an auditor (Betriebsprüfung) which appointments were paid
  in cash, by card, with a voucher or online. Until now a booking only had
  payment_status, and in-shop "mark as paid" recorded no method.

  1. booking_payments: one row per payment; a booking can have several
     (e.g. 30 EUR voucher + 15 EUR cash). Rows are never edited by clients.
  2. Recorded automatically:
     - voucher / service pass applied to a booking (booking_gift_cards insert)
     - Stripe or PayPal checkout completing (bookings.payment_status -> completed)
  3. record_shop_payment(): staff record cash / card / other at the counter.
     The booking turns paid once vouchers + shop payments cover the price.
  4. Backfill of existing vouchers and online payments.
*/

CREATE TABLE IF NOT EXISTS public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cash', 'card', 'gift_card', 'service_pass', 'stripe', 'paypal', 'other')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  gift_card_id uuid REFERENCES public.gift_cards(id) ON DELETE SET NULL,
  reference text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_payments_business_created_idx ON public.booking_payments (business_id, created_at);
CREATE INDEX IF NOT EXISTS booking_payments_booking_idx ON public.booking_payments (booking_id);
-- One row per online checkout, so a repeated webhook cannot count twice.
CREATE UNIQUE INDEX IF NOT EXISTS booking_payments_online_once
  ON public.booking_payments (booking_id, method, reference)
  WHERE method IN ('stripe', 'paypal');

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read their shop's booking payments" ON public.booking_payments;
CREATE POLICY "Admins read their shop's booking payments"
  ON public.booking_payments FOR SELECT TO authenticated
  USING (business_id = public.get_admin_business_id());

REVOKE INSERT, UPDATE, DELETE ON public.booking_payments FROM anon, authenticated;
GRANT SELECT ON public.booking_payments TO authenticated;

-- Voucher or service pass applied to a booking (online or at the counter).
CREATE OR REPLACE FUNCTION private.record_voucher_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, gift_card_id, reference, recorded_by)
  SELECT b.business_id, NEW.booking_id,
         CASE WHEN NEW.redemption_type = 'service_pass' THEN 'service_pass' ELSE 'gift_card' END,
         COALESCE(NEW.amount_used_cents, 0), NEW.gift_card_id, g.code, auth.uid()
  FROM public.bookings b
  LEFT JOIN public.gift_cards g ON g.id = NEW.gift_card_id
  WHERE b.id = NEW.booking_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS record_voucher_payment ON public.booking_gift_cards;
CREATE TRIGGER record_voucher_payment
  AFTER INSERT ON public.booking_gift_cards
  FOR EACH ROW EXECUTE FUNCTION private.record_voucher_payment();

-- Stripe / PayPal checkout completed: the remaining price was paid online.
CREATE OR REPLACE FUNCTION private.record_online_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.paypal_order_id IS NOT NULL THEN
    INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, reference)
    VALUES (NEW.business_id, NEW.id, 'paypal', COALESCE(NEW.final_amount_cents, 0), NEW.paypal_order_id)
    ON CONFLICT DO NOTHING;
  ELSIF NEW.stripe_session_id IS NOT NULL THEN
    INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, reference)
    VALUES (NEW.business_id, NEW.id, 'stripe', COALESCE(NEW.final_amount_cents, 0), NEW.stripe_session_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS record_online_payment ON public.bookings;
CREATE TRIGGER record_online_payment
  AFTER UPDATE OF payment_status, stripe_session_id, paypal_order_id ON public.bookings
  FOR EACH ROW
  WHEN (NEW.payment_status = 'completed' AND (NEW.stripe_session_id IS NOT NULL OR NEW.paypal_order_id IS NOT NULL))
  EXECUTE FUNCTION private.record_online_payment();

-- Counter payment by staff. Returns what is still open on the booking.
CREATE OR REPLACE FUNCTION public.record_shop_payment(p_booking_id uuid, p_method text, p_amount_cents integer)
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
  IF p_method NOT IN ('cash', 'card', 'other') THEN
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
    INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, recorded_by)
    VALUES (v_booking.business_id, p_booking_id, p_method, p_amount_cents, auth.uid());
  END IF;

  -- Vouchers already reduce final_amount_cents, so only counter payments count here.
  SELECT COALESCE(sum(amount_cents), 0) INTO v_paid_in_shop
  FROM public.booking_payments
  WHERE booking_id = p_booking_id AND method IN ('cash', 'card', 'other');

  v_open := GREATEST(0, v_booking.due - v_paid_in_shop);
  IF v_open = 0 THEN
    UPDATE public.bookings SET payment_status = 'completed', updated_at = now() WHERE id = p_booking_id;
  END IF;

  RETURN jsonb_build_object('openCents', v_open);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_shop_payment(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_shop_payment(uuid, text, integer) TO authenticated;

-- Backfill: vouchers already applied and online payments already completed.
INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, gift_card_id, reference, created_at)
SELECT b.business_id, bgc.booking_id,
       CASE WHEN bgc.redemption_type = 'service_pass' THEN 'service_pass' ELSE 'gift_card' END,
       COALESCE(bgc.amount_used_cents, 0), bgc.gift_card_id, g.code, COALESCE(bgc.created_at, b.created_at)
FROM public.booking_gift_cards bgc
JOIN public.bookings b ON b.id = bgc.booking_id
LEFT JOIN public.gift_cards g ON g.id = bgc.gift_card_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_payments p
  WHERE p.booking_id = bgc.booking_id AND p.gift_card_id IS NOT DISTINCT FROM bgc.gift_card_id
    AND p.method IN ('gift_card', 'service_pass')
);

INSERT INTO public.booking_payments (business_id, booking_id, method, amount_cents, reference, created_at)
SELECT business_id, id,
       CASE WHEN paypal_order_id IS NOT NULL THEN 'paypal' ELSE 'stripe' END,
       COALESCE(final_amount_cents, 0), COALESCE(paypal_order_id, stripe_session_id), updated_at
FROM public.bookings
WHERE payment_status = 'completed' AND (paypal_order_id IS NOT NULL OR stripe_session_id IS NOT NULL)
ON CONFLICT DO NOTHING;
