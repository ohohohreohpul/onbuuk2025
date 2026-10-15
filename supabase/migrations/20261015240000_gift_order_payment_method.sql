/*
  Voucher orders paid in the shop remember how they were paid (cash / card),
  chosen with one tap when the order is marked paid. Needed for the cash book
  and a Betriebsprüfung; NULL for orders paid before this change.
*/
ALTER TABLE public.gift_card_orders
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'other'));

DROP FUNCTION IF EXISTS public.mark_gift_card_order_paid(uuid);

CREATE OR REPLACE FUNCTION public.mark_gift_card_order_paid(p_order_id uuid, p_method text DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.gift_card_orders%ROWTYPE;
  v_days integer;
  v_count integer;
BEGIN
  IF p_method IS NOT NULL AND p_method NOT IN ('cash', 'card', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method: %', p_method USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM public.gift_card_orders
  WHERE id = p_order_id AND business_id = public.get_admin_business_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Order is already %', v_order.status;
  END IF;

  SELECT expiry_days INTO v_days FROM public.gift_card_settings WHERE business_id = v_order.business_id;

  UPDATE public.gift_cards g
  SET status = 'active',
      purchased_at = now(),
      expires_at = coalesce(
        now() + make_interval(days => (SELECT o.expiry_days FROM public.service_pass_offers o WHERE o.id = g.service_pass_offer_id)),
        now() + make_interval(days => v_days),
        g.expires_at
      ),
      updated_at = now()
  WHERE g.order_id = v_order.id AND g.status = 'pending_payment';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.gift_card_transactions (gift_card_id, amount_cents, transaction_type, description)
  SELECT g.id, g.purchase_price_cents, 'purchase',
         'Bezahlt im Laden' || CASE p_method WHEN 'cash' THEN ' (Bar)' WHEN 'card' THEN ' (Karte)' ELSE '' END
         || ' · Bestellung ' || v_order.order_number
  FROM public.gift_cards g WHERE g.order_id = v_order.id;

  UPDATE public.gift_card_orders SET status = 'paid', paid_at = now(), payment_method = p_method WHERE id = v_order.id;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_gift_card_order_paid(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_gift_card_order_paid(uuid, text) TO authenticated;
