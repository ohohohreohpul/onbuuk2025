/*
  Undo for counter mistakes, without erasing anything:
  - undo_service_pass_visit: gives back 1 visit for a visit redemption and logs
    an 'undo' line; the original redemption is marked reversed so it can be
    undone only once.
  - reactivate_gift_card: makes a voucher that was made invalid usable again
    and logs a 'reactivate' line with the reason.
*/
ALTER TABLE public.gift_card_transactions
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES public.gift_card_transactions(id);

ALTER TABLE public.gift_card_transactions DROP CONSTRAINT IF EXISTS gift_card_transactions_transaction_type_check;
ALTER TABLE public.gift_card_transactions ADD CONSTRAINT gift_card_transactions_transaction_type_check
  CHECK (transaction_type IN ('purchase', 'redemption', 'refund', 'void', 'undo', 'reactivate'));

CREATE OR REPLACE FUNCTION public.undo_service_pass_visit(p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_txn record;
  v_card record;
  v_undo_id uuid;
  v_remaining integer;
BEGIN
  SELECT t.* INTO v_txn FROM public.gift_card_transactions t WHERE t.id = p_transaction_id FOR UPDATE;
  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Entry not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_card FROM public.gift_cards
   WHERE id = v_txn.gift_card_id AND business_id = public.get_admin_business_id()
   FOR UPDATE;
  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'Entry not found' USING ERRCODE = '42501';
  END IF;
  IF v_card.card_type <> 'service_pass' OR v_txn.transaction_type <> 'redemption' OR COALESCE(v_txn.visit_count, 0) < 1 THEN
    RAISE EXCEPTION 'Only a visit redemption can be undone here' USING ERRCODE = '22023';
  END IF;
  IF v_txn.reversed_by IS NOT NULL THEN
    RAISE EXCEPTION 'This redemption was already undone' USING ERRCODE = '22023';
  END IF;
  IF v_txn.booking_id IS NOT NULL THEN
    RAISE EXCEPTION 'This visit belongs to a booking; correct it in the booking payment' USING ERRCODE = '22023';
  END IF;
  IF v_card.status = 'cancelled' THEN
    RAISE EXCEPTION 'The voucher is invalid; make it valid again first' USING ERRCODE = '22023';
  END IF;

  v_remaining := LEAST(v_card.original_visits, COALESCE(v_card.remaining_visits, 0) + v_txn.visit_count);
  UPDATE public.gift_cards
     SET remaining_visits = v_remaining,
         status = CASE WHEN status = 'fully_redeemed' AND v_remaining > 0 THEN 'active' ELSE status END,
         updated_at = now()
   WHERE id = v_card.id;

  INSERT INTO public.gift_card_transactions (gift_card_id, amount_cents, visit_count, transaction_type, description, created_by)
  VALUES (v_card.id, v_txn.amount_cents, v_txn.visit_count, 'undo', 'Einlösung rückgängig gemacht', auth.uid()::text)
  RETURNING id INTO v_undo_id;
  UPDATE public.gift_card_transactions SET reversed_by = v_undo_id WHERE id = v_txn.id;

  RETURN jsonb_build_object('remainingVisits', v_remaining);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reactivate_gift_card(p_gift_card_id uuid, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_card record;
  v_status text;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_card FROM public.gift_cards
   WHERE id = p_gift_card_id AND business_id = public.get_admin_business_id()
   FOR UPDATE;
  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'Gift card not found' USING ERRCODE = '42501';
  END IF;
  IF v_card.status <> 'cancelled' THEN
    RETURN v_card.status;
  END IF;
  -- Only vouchers made invalid by hand; cancelled unpaid orders stay cancelled.
  IF NOT EXISTS (SELECT 1 FROM public.gift_card_transactions WHERE gift_card_id = v_card.id AND transaction_type = 'void') THEN
    RAISE EXCEPTION 'This voucher was cancelled with its order and cannot be reactivated here' USING ERRCODE = '22023';
  END IF;

  v_status := CASE
    WHEN v_card.card_type = 'service_pass' AND COALESCE(v_card.remaining_visits, 0) = 0 THEN 'fully_redeemed'
    WHEN v_card.card_type = 'value' AND v_card.current_balance_cents = 0 THEN 'fully_redeemed'
    ELSE 'active' END;

  UPDATE public.gift_cards SET status = v_status, updated_at = now() WHERE id = v_card.id;
  INSERT INTO public.gift_card_transactions (gift_card_id, amount_cents, visit_count, transaction_type, description, created_by)
  VALUES (v_card.id, 0, 0, 'reactivate', left(btrim(p_reason), 300), auth.uid()::text);
  RETURN v_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.undo_service_pass_visit(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.reactivate_gift_card(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.undo_service_pass_visit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_gift_card(uuid, text) TO authenticated;
