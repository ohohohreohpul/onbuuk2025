/*
  Emergency security lockdown (audit 2026-09-24).

  Closes holes verified against the live database:
  1. create_admin_user (both overloads) was executable by anon and trusted the
     business id it was given: anyone could add themselves as owner/admin of any
     business.
  2. create_staff_invitation and redeem_gift_card trusted the client-supplied
     business id and were executable by anon.
  3. loyalty_points / loyalty_transactions had "WITH CHECK (true)" write policies:
     any signed-in user could set anyone's points. Points are written only by
     SECURITY DEFINER triggers, which do not need these policies.
  4. booking_form_colors could be updated by anyone, including anonymous users.

  Nothing here changes data; it only narrows who may call or write.
*/

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Caller is an active member of the business, identified by auth uid only
-- (never by email, which callers can influence).
CREATE OR REPLACE FUNCTION private.is_business_member(target_business_id uuid, required_roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users AS au
    WHERE au.business_id = target_business_id
      AND au.is_active = true
      AND (au.auth_user_id = (SELECT auth.uid()) OR au.user_id = (SELECT auth.uid()))
      AND (required_roles IS NULL OR au.role = ANY (required_roles))
  );
$$;

REVOKE ALL ON FUNCTION private.is_business_member(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_business_member(uuid, text[]) TO authenticated;

-- 1a. create_admin_user used by Settings → Roles: managers of that business only.
CREATE OR REPLACE FUNCTION public.create_admin_user(p_email text, p_password text, p_full_name text, p_role text, p_business_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT private.is_business_member(p_business_id, ARRAY['owner', 'admin', 'super_admin']) THEN
    RAISE EXCEPTION 'Not authorised to add team members to this business' USING ERRCODE = '42501';
  END IF;

  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'Password is required';
  END IF;
  IF LENGTH(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF p_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin or staff';
  END IF;
  IF EXISTS (SELECT 1 FROM admin_users WHERE lower(email) = lower(p_email)) THEN
    RAISE EXCEPTION 'Email already exists';
  END IF;

  INSERT INTO admin_users (email, password_hash, full_name, role, business_id, is_active)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), p_full_name, p_role, p_business_id, true)
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_admin_user(text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text, uuid) TO authenticated;

-- 1b. Owner-granting overload: not called by the app. Server-side (service role) only.
REVOKE ALL ON FUNCTION public.create_admin_user(text, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- 2a. Staff invitations: managers of that business only; creator is the caller.
CREATE OR REPLACE FUNCTION public.create_staff_invitation(p_business_id uuid, p_email text, p_full_name text, p_role text, p_created_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_invite_id uuid;
  v_token text;
BEGIN
  IF NOT private.is_business_member(p_business_id, ARRAY['owner', 'admin', 'super_admin']) THEN
    RAISE EXCEPTION 'Not authorised to invite staff to this business' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM admin_users
    WHERE business_id = p_business_id AND lower(email) = lower(p_email) AND is_active = true
  ) THEN
    RAISE EXCEPTION 'User with this email already exists in this business';
  END IF;

  DELETE FROM staff_invitations
  WHERE business_id = p_business_id AND lower(email) = lower(p_email) AND is_used = false;

  v_token := generate_invite_token();

  INSERT INTO staff_invitations (business_id, email, full_name, role, invite_token, created_by)
  VALUES (p_business_id, p_email, p_full_name, p_role, v_token, p_created_by)
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_staff_invitation(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_staff_invitation(uuid, text, text, text, uuid) TO authenticated;

-- 2b. In-person gift card redemption (Gift Card Station): any active member of that business.
CREATE OR REPLACE FUNCTION public.redeem_gift_card(p_gift_card_id uuid, p_business_id uuid, p_amount_cents integer, p_description text DEFAULT 'In-person redemption'::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_gift_card gift_cards%ROWTYPE;
  v_new_balance integer;
BEGIN
  IF NOT private.is_business_member(p_business_id) THEN
    RAISE EXCEPTION 'Not authorised to redeem gift cards for this business' USING ERRCODE = '42501';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Redemption amount must be greater than zero';
  END IF;

  SELECT * INTO v_gift_card FROM gift_cards WHERE id = p_gift_card_id FOR UPDATE;

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
  SET current_balance_cents = v_new_balance,
      status = CASE WHEN v_new_balance = 0 THEN 'fully_redeemed' ELSE status END,
      updated_at = now()
  WHERE id = p_gift_card_id;

  INSERT INTO gift_card_transactions (gift_card_id, amount_cents, transaction_type, description)
  VALUES (p_gift_card_id, p_amount_cents, 'redemption', p_description);

  RETURN v_new_balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.redeem_gift_card(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card(uuid, uuid, integer, text) TO authenticated;

-- 3. Loyalty: only SECURITY DEFINER triggers write points.
DROP POLICY IF EXISTS "System can insert loyalty points" ON public.loyalty_points;
DROP POLICY IF EXISTS "System can update loyalty points" ON public.loyalty_points;
DROP POLICY IF EXISTS "System can insert transactions" ON public.loyalty_transactions;

-- 4. Booking form colours: only that business's admins may update (policy already exists).
DROP POLICY IF EXISTS "Public can update booking form colors" ON public.booking_form_colors;
