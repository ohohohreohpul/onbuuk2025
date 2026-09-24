/*
  Keep service-pass redemptions aligned with the physical booking:

  - a normal booking has one redeemable service unit;
  - a pair booking has two;
  - service passes must be applied before monetary cards so a pass cannot be
    consumed against add-ons after a value card has already paid the service.

  The checkout also orders cards this way, but this trigger is the database
  invariant for concurrent requests and non-browser clients.
*/

CREATE OR REPLACE FUNCTION public.enforce_booking_service_pass_unit_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_pair_booking boolean;
  v_booking_found boolean;
  v_service_passes_used integer;
  v_value_card_used boolean;
  v_maximum_service_passes integer;
BEGIN
  IF NEW.redemption_type <> 'service_pass' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(booking.is_pair_booking, false), true
  INTO v_is_pair_booking, v_booking_found
  FROM public.bookings AS booking
  WHERE booking.id = NEW.booking_id;

  IF NOT COALESCE(v_booking_found, false) THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT
    count(*) FILTER (WHERE applied.redemption_type = 'service_pass'),
    COALESCE(bool_or(applied.redemption_type = 'value'), false)
  INTO v_service_passes_used, v_value_card_used
  FROM public.booking_gift_cards AS applied
  WHERE applied.booking_id = NEW.booking_id;

  IF v_value_card_used THEN
    RAISE EXCEPTION 'Service passes must be applied before value cards';
  END IF;

  v_maximum_service_passes := CASE WHEN v_is_pair_booking THEN 2 ELSE 1 END;

  IF v_service_passes_used >= v_maximum_service_passes THEN
    RAISE EXCEPTION 'All service units on this booking are already covered by passes';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_booking_service_pass_unit_limit_before_insert
  BEFORE INSERT ON public.booking_gift_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_service_pass_unit_limit();

REVOKE ALL ON FUNCTION public.enforce_booking_service_pass_unit_limit() FROM PUBLIC;
