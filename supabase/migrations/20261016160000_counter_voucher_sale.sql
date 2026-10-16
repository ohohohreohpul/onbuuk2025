-- Sell a voucher at the counter in one step (calendar "Gutschein verkaufen").
-- The online order function and the counter sale now share one body
-- (private.create_gift_card_order), so vouchers, sets, expiry, promotion gift
-- and the Kassenbuch (trigger gift_order_to_cash) behave the same way.
-- Counter differences: email optional, no "pay in store" switch needed, no
-- online abuse limits, any amount from 1 € to 1,000 €.

ALTER TABLE public.gift_card_orders ALTER COLUMN buyer_email DROP NOT NULL;

CREATE OR REPLACE FUNCTION private.create_gift_card_order(
  p_business_id uuid, p_buyer_name text, p_buyer_email text, p_package_id uuid, p_service_pass_offer_id uuid,
  p_value_cents integer, p_buyer_phone text, p_recipient_name text, p_recipient_email text, p_message text,
  p_at_counter boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settings public.gift_card_settings%ROWTYPE;
  v_package public.gift_card_packages%ROWTYPE;
  v_offer public.service_pass_offers%ROWTYPE;
  v_item record;
  v_order_id uuid;
  v_order_number text;
  v_title text;
  v_total integer;
  v_minutes integer := 0;
  v_bonus text;
  v_promo_active boolean;
  v_expires timestamptz;
  v_standard_total bigint := 0;
  v_item_value bigint;
  v_allocated integer := 0;
  v_card_price integer;
  v_items_left integer;
  v_email text := lower(btrim(coalesce(p_buyer_email, '')));
  i integer;
BEGIN
  -- Input
  IF num_nonnulls(p_package_id, p_service_pass_offer_id, p_value_cents) <> 1 THEN
    RAISE EXCEPTION 'ORDER_INVALID: choose exactly one package, pass or amount';
  END IF;
  IF length(btrim(coalesce(p_buyer_name, ''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'ORDER_INVALID: name';
  END IF;
  IF (NOT p_at_counter OR v_email <> '')
     AND (v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254) THEN
    RAISE EXCEPTION 'ORDER_INVALID: email';
  END IF;
  IF p_at_counter AND v_email = '' THEN
    v_email := NULL; -- counter sale without email
  END IF;
  IF p_recipient_email IS NOT NULL AND btrim(p_recipient_email) <> ''
     AND lower(btrim(p_recipient_email)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'ORDER_INVALID: recipient email';
  END IF;
  IF length(coalesce(p_message, '')) > 500 OR length(coalesce(p_buyer_phone, '')) > 40
     OR length(coalesce(p_recipient_name, '')) > 120 THEN
    RAISE EXCEPTION 'ORDER_INVALID: text too long';
  END IF;

  SELECT * INTO v_settings FROM public.gift_card_settings WHERE business_id = p_business_id;
  IF NOT p_at_counter AND (NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.pay_in_store_enabled) THEN
    RAISE EXCEPTION 'ORDER_UNAVAILABLE: vouchers cannot be ordered online';
  END IF;

  -- Abuse limits: open orders per email and per shop
  IF NOT p_at_counter AND (SELECT count(*) FROM public.gift_card_orders o
      WHERE o.business_id = p_business_id AND lower(o.buyer_email) = v_email
        AND o.status = 'pending_payment' AND o.created_at > now() - interval '1 day') >= 5
     OR (SELECT count(*) FROM public.gift_card_orders o
      WHERE o.business_id = p_business_id AND o.created_at > now() - interval '1 hour') >= 60 AND NOT p_at_counter THEN
    RAISE EXCEPTION 'ORDER_LIMIT: too many orders, please contact the shop';
  END IF;

  v_expires := CASE WHEN v_settings.expiry_days IS NULL THEN NULL ELSE now() + make_interval(days => v_settings.expiry_days) END;

  IF p_package_id IS NOT NULL THEN
    SELECT * INTO v_package FROM public.gift_card_packages
    WHERE id = p_package_id AND business_id = p_business_id
    FOR UPDATE;
    IF NOT FOUND OR NOT v_package.is_active
       OR (v_package.valid_from IS NOT NULL AND now() < v_package.valid_from)
       OR (v_package.valid_until IS NOT NULL AND now() >= v_package.valid_until) THEN
      RAISE EXCEPTION 'ORDER_UNAVAILABLE: this package is not available';
    END IF;
    IF v_package.stock_limit IS NOT NULL AND v_package.sold_count >= v_package.stock_limit THEN
      RAISE EXCEPTION 'ORDER_SOLD_OUT: this package is sold out';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gift_card_package_items WHERE package_id = v_package.id) THEN
      RAISE EXCEPTION 'ORDER_UNAVAILABLE: this package has no vouchers';
    END IF;
    v_title := v_package.name;
    v_total := v_package.price_cents;
    v_bonus := v_package.bonus_note;
    UPDATE public.gift_card_packages SET sold_count = sold_count + 1, updated_at = now() WHERE id = v_package.id;
    SELECT coalesce(max(d.duration_minutes), 0) INTO v_minutes
    FROM public.gift_card_package_items it JOIN public.service_durations d ON d.id = it.duration_id
    WHERE it.package_id = v_package.id;
  ELSIF p_service_pass_offer_id IS NOT NULL THEN
    SELECT * INTO v_offer FROM public.service_pass_offers
    WHERE id = p_service_pass_offer_id AND business_id = p_business_id AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORDER_UNAVAILABLE: this voucher is not available';
    END IF;
    v_title := v_offer.name;
    v_total := v_offer.price_cents;
    SELECT d.duration_minutes INTO v_minutes FROM public.service_durations d WHERE d.id = v_offer.duration_id;
    IF v_offer.expiry_days IS NOT NULL THEN
      v_expires := now() + make_interval(days => v_offer.expiry_days);
    END IF;
  ELSE
    IF p_at_counter THEN
      IF p_value_cents IS NULL OR p_value_cents NOT BETWEEN 100 AND 100000 THEN
        RAISE EXCEPTION 'ORDER_INVALID: amount not allowed';
      END IF;
    ELSIF NOT (
      p_value_cents = ANY (coalesce(v_settings.preset_amounts_cents, '{}'::integer[]))
      OR (v_settings.allow_custom_amount
          AND p_value_cents BETWEEN coalesce(v_settings.min_custom_amount_cents, 1) AND coalesce(v_settings.max_custom_amount_cents, 100000))
    ) THEN
      RAISE EXCEPTION 'ORDER_INVALID: amount not allowed';
    END IF;
    v_title := 'Wertgutschein';
    v_total := p_value_cents;
  END IF;

  -- Promotion gift ("ab 70 € oder ab 60 Minuten")
  v_promo_active := v_settings.promo_gift_note IS NOT NULL
    AND (v_settings.promo_valid_from IS NULL OR now() >= v_settings.promo_valid_from)
    AND (v_settings.promo_valid_until IS NULL OR now() < v_settings.promo_valid_until)
    AND (
      (v_settings.promo_gift_min_cents IS NOT NULL AND v_total >= v_settings.promo_gift_min_cents)
      OR (v_settings.promo_gift_min_minutes IS NOT NULL AND v_minutes >= v_settings.promo_gift_min_minutes)
    );
  IF v_promo_active THEN
    v_bonus := concat_ws(' · ', v_settings.promo_gift_note, v_bonus);
  END IF;

  -- Order number: short, readable, unique per shop
  LOOP
    v_order_number := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.gift_card_orders WHERE business_id = p_business_id AND order_number = v_order_number);
  END LOOP;

  INSERT INTO public.gift_card_orders (
    business_id, order_number, package_id, title, total_cents, buyer_name, buyer_email, buyer_phone,
    recipient_name, recipient_email, message, bonus_note
  ) VALUES (
    p_business_id, v_order_number, p_package_id, v_title, v_total, btrim(p_buyer_name), v_email,
    nullif(btrim(coalesce(p_buyer_phone, '')), ''), nullif(btrim(coalesce(p_recipient_name, '')), ''),
    nullif(lower(btrim(coalesce(p_recipient_email, ''))), ''), nullif(btrim(coalesce(p_message, '')), ''), v_bonus
  ) RETURNING id INTO v_order_id;

  -- Vouchers (inactive until paid)
  IF p_package_id IS NOT NULL THEN
    -- Split the package price across its vouchers by standard value, for reporting.
    SELECT coalesce(sum(CASE WHEN it.kind = 'value' THEN it.value_cents::bigint * it.quantity
                             ELSE d.price_cents::bigint * it.quantity END), 0)
    INTO v_standard_total
    FROM public.gift_card_package_items it LEFT JOIN public.service_durations d ON d.id = it.duration_id
    WHERE it.package_id = p_package_id;

    SELECT count(*) INTO v_items_left FROM (
      SELECT 1 FROM public.gift_card_package_items it, generate_series(1, CASE WHEN it.kind = 'value' THEN it.quantity ELSE 1 END)
      WHERE it.package_id = p_package_id
    ) x;

    FOR v_item IN
      SELECT it.*, s.name AS service_name, d.duration_minutes, d.price_cents AS duration_price
      FROM public.gift_card_package_items it
      LEFT JOIN public.services s ON s.id = it.service_id
      LEFT JOIN public.service_durations d ON d.id = it.duration_id
      WHERE it.package_id = p_package_id
      ORDER BY it.display_order, it.id
    LOOP
      FOR i IN 1 .. CASE WHEN v_item.kind = 'value' THEN v_item.quantity ELSE 1 END LOOP
        v_item_value := CASE WHEN v_item.kind = 'value' THEN v_item.value_cents ELSE v_item.duration_price::bigint * v_item.quantity END;
        v_items_left := v_items_left - 1;
        v_card_price := CASE
          WHEN v_items_left = 0 THEN v_total - v_allocated
          WHEN v_standard_total > 0 THEN round(v_total::numeric * v_item_value / v_standard_total)::integer
          ELSE 0 END;
        v_card_price := greatest(v_card_price, 1);
        v_allocated := v_allocated + v_card_price;

        IF v_item.kind = 'value' THEN
          INSERT INTO public.gift_cards (
            business_id, code, card_type, original_value_cents, current_balance_cents, purchase_price_cents,
            status, purchased_for_email, purchased_by_email, purchased_by_name, expires_at, order_id
          ) VALUES (
            p_business_id, public.generate_gift_card_code(p_business_id), 'value', v_item.value_cents, v_item.value_cents,
            v_card_price, 'pending_payment', nullif(lower(btrim(coalesce(p_recipient_email, ''))), ''),
            v_email, btrim(p_buyer_name), v_expires, v_order_id
          );
        ELSE
          INSERT INTO public.gift_cards (
            business_id, code, card_type, original_value_cents, current_balance_cents, purchase_price_cents,
            service_pass_name, service_id, duration_id, original_visits, remaining_visits,
            status, purchased_for_email, purchased_by_email, purchased_by_name, expires_at, order_id
          ) VALUES (
            p_business_id, public.generate_gift_card_code(p_business_id), 'service_pass', 0, 0, v_card_price,
            coalesce(v_item.label, v_item.service_name || ' ' || v_item.duration_minutes || ' Min'),
            v_item.service_id, v_item.duration_id, v_item.quantity, v_item.quantity,
            'pending_payment', nullif(lower(btrim(coalesce(p_recipient_email, ''))), ''),
            v_email, btrim(p_buyer_name), v_expires, v_order_id
          );
        END IF;
      END LOOP;
    END LOOP;
  ELSIF p_service_pass_offer_id IS NOT NULL THEN
    INSERT INTO public.gift_cards (
      business_id, code, card_type, original_value_cents, current_balance_cents, purchase_price_cents,
      service_pass_offer_id, service_pass_name, service_id, duration_id, original_visits, remaining_visits,
      status, purchased_for_email, purchased_by_email, purchased_by_name, expires_at, order_id
    ) VALUES (
      p_business_id, public.generate_gift_card_code(p_business_id), 'service_pass', 0, 0, v_total,
      v_offer.id, v_offer.name, v_offer.service_id, v_offer.duration_id, v_offer.visit_count, v_offer.visit_count,
      'pending_payment', nullif(lower(btrim(coalesce(p_recipient_email, ''))), ''),
      v_email, btrim(p_buyer_name), v_expires, v_order_id
    );
  ELSE
    INSERT INTO public.gift_cards (
      business_id, code, card_type, original_value_cents, current_balance_cents, purchase_price_cents,
      status, purchased_for_email, purchased_by_email, purchased_by_name, expires_at, order_id
    ) VALUES (
      p_business_id, public.generate_gift_card_code(p_business_id), 'value', v_total, v_total, v_total,
      'pending_payment', nullif(lower(btrim(coalesce(p_recipient_email, ''))), ''),
      v_email, btrim(p_buyer_name), v_expires, v_order_id
    );
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'title', v_title,
    'total_cents', v_total,
    'bonus_note', v_bonus
  );
END;
$$;
REVOKE ALL ON FUNCTION private.create_gift_card_order(uuid, text, text, uuid, uuid, integer, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.place_gift_card_order(
  p_business_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_package_id uuid DEFAULT NULL,
  p_service_pass_offer_id uuid DEFAULT NULL,
  p_value_cents integer DEFAULT NULL,
  p_buyer_phone text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.create_gift_card_order(p_business_id, p_buyer_name, p_buyer_email, p_package_id, p_service_pass_offer_id,
    p_value_cents, p_buyer_phone, p_recipient_name, p_recipient_email, p_message, false);
$$;
REVOKE ALL ON FUNCTION public.place_gift_card_order(uuid, text, text, uuid, uuid, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_gift_card_order(uuid, text, text, uuid, uuid, integer, text, text, text, text) TO anon, authenticated;

-- Admin only: create + mark paid in one transaction; returns the order and its voucher codes.
CREATE OR REPLACE FUNCTION public.sell_gift_card_at_counter(
  p_package_id uuid,
  p_service_pass_offer_id uuid,
  p_value_cents integer,
  p_method text,
  p_buyer_name text DEFAULT NULL,
  p_buyer_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business uuid := public.get_admin_business_id();
  v_order jsonb;
  v_codes jsonb;
BEGIN
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_method NOT IN ('cash', 'card', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method: %', p_method USING ERRCODE = '22023';
  END IF;
  v_order := private.create_gift_card_order(
    v_business, coalesce(nullif(btrim(coalesce(p_buyer_name, '')), ''), 'Kasse'), p_buyer_email,
    p_package_id, p_service_pass_offer_id, p_value_cents, NULL, NULL, NULL, NULL, true);
  PERFORM public.mark_gift_card_order_paid((v_order->>'order_id')::uuid, p_method);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'code', g.code, 'type', g.card_type,
           'value_cents', g.original_value_cents, 'visits', g.original_visits, 'name', g.service_pass_name) ORDER BY g.created_at), '[]'::jsonb)
    INTO v_codes
  FROM public.gift_cards g WHERE g.order_id = (v_order->>'order_id')::uuid;
  RETURN v_order || jsonb_build_object('cards', v_codes);
END;
$$;
REVOKE ALL ON FUNCTION public.sell_gift_card_at_counter(uuid, uuid, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sell_gift_card_at_counter(uuid, uuid, integer, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
