/*
  # Add In-Person Gift Card Redemption Function

  ## Changes
  1. Add `redeem_gift_card(p_gift_card_id, p_business_id, p_amount_cents, p_description)`
     - Locks the gift card row, validates it belongs to the calling business,
       is active, not expired, and has sufficient balance.
     - Decrements the balance, flips status to 'redeemed' once it hits zero,
       and records a `gift_card_transactions` row of type 'redemption'.
     - Mirrors the existing `apply_gift_card_to_booking` locking pattern so
       concurrent redemptions (e.g. two staff scanning the same card) can't
       double-spend the balance.
     - Returns the resulting balance in cents.

  ## Security
  - SECURITY DEFINER with a business_id check inside the function body, so it
    can only touch gift cards belonging to the business passed in.
*/

CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  p_gift_card_id uuid,
  p_business_id uuid,
  p_amount_cents integer,
  p_description text DEFAULT 'In-person redemption'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gift_card gift_cards%ROWTYPE;
  v_new_balance integer;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Redemption amount must be greater than zero';
  END IF;

  SELECT * INTO v_gift_card
  FROM gift_cards
  WHERE id = p_gift_card_id
  FOR UPDATE;

  IF v_gift_card.id IS NULL THEN
    RAISE EXCEPTION 'Gift card not found';
  END IF;

  IF v_gift_card.business_id != p_business_id THEN
    RAISE EXCEPTION 'Gift card does not belong to this business';
  END IF;

  IF v_gift_card.status != 'active' THEN
    RAISE EXCEPTION 'Gift card is not active';
  END IF;

  IF v_gift_card.expires_at IS NOT NULL AND v_gift_card.expires_at < now() THEN
    RAISE EXCEPTION 'Gift card has expired';
  END IF;

  IF v_gift_card.current_balance_cents < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient gift card balance';
  END IF;

  v_new_balance := v_gift_card.current_balance_cents - p_amount_cents;

  UPDATE gift_cards
  SET
    current_balance_cents = v_new_balance,
    -- Match the status vocabulary enforced by the gift_cards CHECK constraint
    -- (active | fully_redeemed | expired) and the existing apply_gift_card_to_booking.
    status = CASE WHEN v_new_balance = 0 THEN 'fully_redeemed' ELSE status END,
    updated_at = now()
  WHERE id = p_gift_card_id;

  -- Store the amount as a positive value; the transaction_type ('redemption')
  -- conveys direction, matching apply_gift_card_to_booking and the admin UI.
  INSERT INTO gift_card_transactions (gift_card_id, amount_cents, transaction_type, description)
  VALUES (p_gift_card_id, p_amount_cents, 'redemption', p_description);

  RETURN v_new_balance;
END;
$$;
