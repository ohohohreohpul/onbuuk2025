-- Voucher set editor: create or update a set and replace its contents in one
-- transaction. Only the admin's own shop; treatments must belong to it.
-- Contents changes apply to future sales only (sold vouchers are separate rows).

CREATE OR REPLACE FUNCTION public.save_gift_card_package(p_package_id uuid, p_package jsonb, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business uuid := public.get_admin_business_id();
  v_id uuid := p_package_id;
  v_item jsonb;
  v_kind text;
  v_order integer := 0;
BEGIN
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'A set needs between 1 and 10 items' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.gift_card_packages (business_id, name, subtitle, description, price_cents, compare_at_cents,
      bonus_note, valid_from, valid_until, stock_limit, is_active, display_order)
    VALUES (v_business, btrim(p_package->>'name'), NULLIF(btrim(p_package->>'subtitle'), ''), NULLIF(btrim(p_package->>'description'), ''),
      (p_package->>'price_cents')::integer, NULLIF(p_package->>'compare_at_cents', '')::integer,
      NULLIF(btrim(p_package->>'bonus_note'), ''), NULLIF(p_package->>'valid_from', '')::timestamptz, NULLIF(p_package->>'valid_until', '')::timestamptz,
      NULLIF(p_package->>'stock_limit', '')::integer, COALESCE((p_package->>'is_active')::boolean, true),
      COALESCE((SELECT max(display_order) + 1 FROM public.gift_card_packages WHERE business_id = v_business), 0))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.gift_card_packages SET
      name = btrim(p_package->>'name'),
      subtitle = NULLIF(btrim(p_package->>'subtitle'), ''),
      description = NULLIF(btrim(p_package->>'description'), ''),
      price_cents = (p_package->>'price_cents')::integer,
      compare_at_cents = NULLIF(p_package->>'compare_at_cents', '')::integer,
      bonus_note = NULLIF(btrim(p_package->>'bonus_note'), ''),
      valid_from = NULLIF(p_package->>'valid_from', '')::timestamptz,
      valid_until = NULLIF(p_package->>'valid_until', '')::timestamptz,
      stock_limit = NULLIF(p_package->>'stock_limit', '')::integer,
      is_active = COALESCE((p_package->>'is_active')::boolean, is_active),
      updated_at = now()
    WHERE id = v_id AND business_id = v_business;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Voucher set not found' USING ERRCODE = 'P0002';
    END IF;
    DELETE FROM public.gift_card_package_items WHERE package_id = v_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_kind := v_item->>'kind';
    IF v_kind = 'service_pass' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.service_durations d JOIN public.services s ON s.id = d.service_id
        WHERE d.id = (v_item->>'duration_id')::uuid AND s.id = (v_item->>'service_id')::uuid AND s.business_id = v_business
      ) THEN
        RAISE EXCEPTION 'Unknown treatment in the set' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.gift_card_package_items (package_id, business_id, kind, service_id, duration_id, quantity, label, display_order)
      VALUES (v_id, v_business, 'service_pass', (v_item->>'service_id')::uuid, (v_item->>'duration_id')::uuid,
        (v_item->>'quantity')::integer, NULLIF(btrim(v_item->>'label'), ''), v_order);
    ELSIF v_kind = 'value' THEN
      INSERT INTO public.gift_card_package_items (package_id, business_id, kind, value_cents, quantity, label, display_order)
      VALUES (v_id, v_business, 'value', (v_item->>'value_cents')::integer, (v_item->>'quantity')::integer, NULLIF(btrim(v_item->>'label'), ''), v_order);
    ELSE
      RAISE EXCEPTION 'Unknown item kind' USING ERRCODE = '22023';
    END IF;
    v_order := v_order + 1;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_gift_card_package(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_gift_card_package(uuid, jsonb, jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
