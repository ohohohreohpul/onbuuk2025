/*
  Kassenbuch is fed automatically:
  - every booking payment (Bar, Karte, online, other) → one line, source 'booking'
  - a corrected / undone payment → a reversal line (negative), never a deletion (GoBD)
  - a gift card order that becomes paid → one line "Gutschein-Verkauf"
  Voucher redemptions (gift_card / service_pass) are not new revenue: the money
  was booked when the voucher was sold, so they create no line.
*/
ALTER TABLE public.cash_entries
  ADD COLUMN IF NOT EXISTS booking_payment_id uuid REFERENCES public.booking_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_card_order_id uuid REFERENCES public.gift_card_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reversal boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS cash_entries_payment_once
  ON public.cash_entries (booking_payment_id, is_reversal) WHERE booking_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cash_entries_order_once
  ON public.cash_entries (gift_card_order_id) WHERE gift_card_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.shop_default_vat_bps(p_business_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT btrim(value::text, '" ')::integer
       FROM public.site_settings
      WHERE business_id = p_business_id AND key = 'tax_default_vat_bps'
        AND btrim(value::text, '" ') ~ '^[0-9]+$'
      LIMIT 1),
    1900);
$function$;

CREATE OR REPLACE FUNCTION private.cash_method_of(p_method text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE WHEN p_method IN ('stripe', 'paypal') THEN 'online'
              WHEN p_method IN ('cash', 'card') THEN p_method
              ELSE 'other' END;
$function$;

-- One Kassenbuch line for a booking payment (or its reversal).
CREATE OR REPLACE FUNCTION private.book_payment_to_cash(p_payment_id uuid, p_reversal boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v record;
  v_vat integer;
  v_sign integer := CASE WHEN p_reversal THEN -1 ELSE 1 END;
  v_at timestamptz;
BEGIN
  SELECT p.*, b.customer_name, s.name AS service_name
    INTO v
    FROM public.booking_payments p
    JOIN public.bookings b ON b.id = p.booking_id
    LEFT JOIN public.services s ON s.id = b.service_id
   WHERE p.id = p_payment_id;
  IF v.id IS NULL OR v.method IN ('gift_card', 'service_pass') OR v.amount_cents = 0 THEN
    RETURN;
  END IF;

  v_vat := private.shop_default_vat_bps(v.business_id);
  v_at := CASE WHEN p_reversal THEN COALESCE(v.voided_at, now()) ELSE v.created_at END;

  INSERT INTO public.cash_entries (
    business_id, entry_date, entry_time, description, source, booking_id, booking_payment_id, is_reversal,
    payment_method, gross_cents, net_cents, vat_rate_bps, created_by
  ) VALUES (
    v.business_id,
    (v_at AT TIME ZONE 'Europe/Berlin')::date,
    (v_at AT TIME ZONE 'Europe/Berlin')::time,
    CASE WHEN p_reversal THEN 'Storno: ' ELSE '' END
      || COALESCE(v.service_name, 'Buchung') || ' – ' || COALESCE(v.customer_name, ''),
    'booking', v.booking_id, v.id, p_reversal,
    private.cash_method_of(v.method),
    v_sign * v.amount_cents,
    v_sign * round(v.amount_cents / (1 + v_vat / 10000.0))::integer,
    v_vat,
    CASE WHEN p_reversal THEN v.voided_by ELSE v.recorded_by END
  )
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION private.booking_payment_to_cash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.book_payment_to_cash(NEW.id, false);
  ELSIF NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL THEN
    PERFORM private.book_payment_to_cash(NEW.id, true);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS booking_payment_to_cash ON public.booking_payments;
CREATE TRIGGER booking_payment_to_cash
  AFTER INSERT OR UPDATE OF voided_at ON public.booking_payments
  FOR EACH ROW EXECUTE FUNCTION private.booking_payment_to_cash();

-- One Kassenbuch line when a gift card order is paid (in the shop or online).
-- Treatment vouchers (Einzweckgutschein) carry VAT at sale; value vouchers
-- (Mehrzweckgutschein) are taxed when redeemed, so the sale line has 0 %.
CREATE OR REPLACE FUNCTION private.book_order_to_cash(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v record;
  v_vat integer;
  v_at timestamptz;
BEGIN
  SELECT * INTO v FROM public.gift_card_orders WHERE id = p_order_id AND status = 'paid';
  IF v.id IS NULL OR COALESCE(v.total_cents, 0) = 0 THEN
    RETURN;
  END IF;

  v_vat := CASE WHEN EXISTS (SELECT 1 FROM public.gift_cards g WHERE g.order_id = v.id AND g.card_type = 'value')
                THEN 0 ELSE private.shop_default_vat_bps(v.business_id) END;
  v_at := COALESCE(v.paid_at, now());

  INSERT INTO public.cash_entries (
    business_id, entry_date, entry_time, description, source, gift_card_order_id,
    payment_method, gross_cents, net_cents, vat_rate_bps
  ) VALUES (
    v.business_id,
    (v_at AT TIME ZONE 'Europe/Berlin')::date,
    (v_at AT TIME ZONE 'Europe/Berlin')::time,
    'Gutschein-Verkauf ' || v.order_number || ' – ' || COALESCE(v.buyer_name, ''),
    'booking',
    v.id,
    COALESCE(v.payment_method, 'online'),
    v.total_cents,
    round(v.total_cents / (1 + v_vat / 10000.0))::integer,
    v_vat
  )
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION private.gift_order_to_cash()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
    PERFORM private.book_order_to_cash(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS gift_order_to_cash ON public.gift_card_orders;
CREATE TRIGGER gift_order_to_cash
  AFTER UPDATE OF status ON public.gift_card_orders
  FOR EACH ROW EXECUTE FUNCTION private.gift_order_to_cash();

-- Backfill everything since the payments ledger started.
SELECT private.book_payment_to_cash(id, false) FROM public.booking_payments;
SELECT private.book_payment_to_cash(id, true) FROM public.booking_payments WHERE voided_at IS NOT NULL;
SELECT private.book_order_to_cash(id) FROM public.gift_card_orders
 WHERE status = 'paid' AND paid_at >= '2026-10-15';
