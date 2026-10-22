/*
  Vouchers are never deleted by the shop (GoBD, and so a customer can never
  claim a used voucher was "never used"):
  - "Ungültig machen" sets status 'cancelled' and logs a 'void' line with reason.
  - shop admins lose DELETE on gift_cards.

  Paper vouchers sold at the counter (not in Zenno, e.g. "TS60-100") are
  recorded as booking payments with method 'gift_card', no gift_card_id and
  the voucher number as reference. The same number can be used only once.
*/

-- 1. Void instead of delete.
ALTER TABLE public.gift_card_transactions DROP CONSTRAINT IF EXISTS gift_card_transactions_transaction_type_check;
ALTER TABLE public.gift_card_transactions ADD CONSTRAINT gift_card_transactions_transaction_type_check
  CHECK (transaction_type IN ('purchase', 'redemption', 'refund', 'void'));

CREATE OR REPLACE FUNCTION public.void_gift_card(p_gift_card_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_card record;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT id, status INTO v_card FROM public.gift_cards
   WHERE id = p_gift_card_id AND business_id = public.get_admin_business_id()
   FOR UPDATE;
  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'Gift card not found' USING ERRCODE = '42501';
  END IF;
  IF v_card.status = 'cancelled' THEN
    RETURN;
  END IF;

  UPDATE public.gift_cards SET status = 'cancelled', updated_at = now() WHERE id = v_card.id;
  INSERT INTO public.gift_card_transactions (gift_card_id, amount_cents, visit_count, transaction_type, description, created_by)
  VALUES (v_card.id, 0, 0, 'void', left(btrim(p_reason), 300), auth.uid()::text);
END;
$function$;

REVOKE ALL ON FUNCTION public.void_gift_card(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.void_gift_card(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Admins can delete gift cards" ON public.gift_cards;

-- 2. A paper voucher number can pay only once.
CREATE OR REPLACE FUNCTION private.guard_paper_voucher_reuse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_used_at timestamptz;
BEGIN
  IF NEW.method <> 'gift_card' OR NEW.gift_card_id IS NOT NULL OR NULLIF(btrim(NEW.reference), '') IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT created_at INTO v_used_at
    FROM public.booking_payments
   WHERE business_id = NEW.business_id
     AND method = 'gift_card' AND gift_card_id IS NULL AND voided_at IS NULL
     AND upper(btrim(reference)) = upper(btrim(NEW.reference))
   LIMIT 1;
  IF v_used_at IS NOT NULL THEN
    RAISE EXCEPTION 'PAPER_VOUCHER_USED:%', to_char(v_used_at AT TIME ZONE 'Europe/Berlin', 'DD.MM.YYYY')
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_paper_voucher_reuse ON public.booking_payments;
CREATE TRIGGER guard_paper_voucher_reuse
  BEFORE INSERT ON public.booking_payments
  FOR EACH ROW EXECUTE FUNCTION private.guard_paper_voucher_reuse();
