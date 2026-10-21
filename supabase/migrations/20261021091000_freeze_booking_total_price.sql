/*
  Invoices use bookings.total_price_cents and fall back to the service's
  current price. Freeze it on every booking so a later price change never
  rewrites an old invoice. Aqua-Facial bookings were made at 80 € before the
  price became 85 €: their booked price is kept in final_amount_cents.
*/
UPDATE public.bookings b
   SET total_price_cents = COALESCE(b.final_amount_cents + COALESCE(b.gift_card_amount_cents, 0), d.price_cents)
  FROM public.service_durations d
 WHERE b.duration_id = d.id AND b.total_price_cents IS NULL;

CREATE OR REPLACE FUNCTION private.booking_default_price()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_price integer;
BEGIN
  IF NEW.duration_id IS NOT NULL AND (NEW.final_amount_cents IS NULL OR NEW.total_price_cents IS NULL) THEN
    SELECT price_cents INTO v_price FROM public.service_durations WHERE id = NEW.duration_id;
    NEW.final_amount_cents := COALESCE(NEW.final_amount_cents, v_price);
    NEW.total_price_cents := COALESCE(NEW.total_price_cents, v_price);
  END IF;
  RETURN NEW;
END;
$function$;
