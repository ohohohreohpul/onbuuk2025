/*
  Gift card packages ("Gutscheinpakete"), pay-in-store orders, and a security
  lockdown of gift card tables.

  A. Lockdown. Until now anyone (no login) could read every voucher incl. its
     code, insert vouchers, update balances and insert transactions. After this:
       - vouchers: admins of the business; customers see vouchers they claimed;
         buyers see their purchase through get_gift_card_receipt(...)
       - writes: admins and SECURITY DEFINER functions only
  B. Packages: a fixed price for several vouchers (service passes and/or value
     vouchers), optional sale window, stock and a bonus note (e.g. a gift).
  C. Orders: customers order online and pay in the shop. Vouchers are created
     as 'pending_payment' (not redeemable, code not shown) and activated by the
     shop with mark_gift_card_order_paid(...).
  D. Promotion note on gift_card_settings ("ab 70 € oder ab 60 Minuten").
*/

-- ─── A. Lockdown ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view gift cards by code" ON public.gift_cards;
DROP POLICY IF EXISTS "System can insert gift cards" ON public.gift_cards;
DROP POLICY IF EXISTS "System can update gift cards" ON public.gift_cards;
DROP POLICY IF EXISTS "System can update gift card balance during redemption" ON public.gift_cards;

DROP POLICY IF EXISTS "Admins can view own business gift cards" ON public.gift_cards;
CREATE POLICY "Admins can view own business gift cards"
  ON public.gift_cards FOR SELECT TO authenticated
  USING (business_id = public.get_admin_business_id());

DROP POLICY IF EXISTS "Admins can insert own business gift cards" ON public.gift_cards;
CREATE POLICY "Admins can insert own business gift cards"
  ON public.gift_cards FOR INSERT TO authenticated
  WITH CHECK (business_id = public.get_admin_business_id());

DROP POLICY IF EXISTS "Customers can view their claimed gift cards" ON public.gift_cards;
CREATE POLICY "Customers can view their claimed gift cards"
  ON public.gift_cards FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT cg.gift_card_id FROM public.customer_gift_cards cg
      WHERE cg.customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Anyone can insert gift card transactions" ON public.gift_card_transactions;
DROP POLICY IF EXISTS "Admins can insert own gift card transactions" ON public.gift_card_transactions;
CREATE POLICY "Admins can insert own gift card transactions"
  ON public.gift_card_transactions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gift_cards g
      WHERE g.id = gift_card_id AND g.business_id = public.get_admin_business_id()
    )
  );

-- Success page after Stripe/PayPal: the session id or card id (both unguessable)
-- identifies the buyer's own voucher.
CREATE OR REPLACE FUNCTION public.get_gift_card_receipt(
  p_session_id text DEFAULT NULL,
  p_gift_card_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT to_jsonb(g) || jsonb_build_object(
    'service_durations', CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object('duration_minutes', d.duration_minutes) END
  )
  FROM public.gift_cards g
  LEFT JOIN public.service_durations d ON d.id = g.duration_id
  WHERE g.status <> 'pending_payment'
    AND (
      (p_session_id IS NOT NULL AND length(p_session_id) >= 20 AND g.stripe_session_id = p_session_id)
      OR (p_gift_card_id IS NOT NULL AND g.id = p_gift_card_id)
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_gift_card_receipt(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gift_card_receipt(text, uuid) TO anon, authenticated;

-- Customer portal "claim a voucher": look up one voucher by its code.
CREATE OR REPLACE FUNCTION public.find_gift_card_for_claim(p_business_id uuid, p_code text)
RETURNS TABLE (id uuid, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT g.id, g.status
  FROM public.gift_cards g
  WHERE g.business_id = p_business_id
    AND upper(btrim(g.code)) = upper(btrim(p_code))
    AND (SELECT auth.uid()) IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_gift_card_for_claim(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_gift_card_for_claim(uuid, text) TO authenticated;

-- ─── B. Packages ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gift_card_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  subtitle text CHECK (subtitle IS NULL OR length(subtitle) <= 160),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  compare_at_cents integer CHECK (compare_at_cents IS NULL OR compare_at_cents > 0),
  bonus_note text CHECK (bonus_note IS NULL OR length(bonus_note) <= 300),
  cover_url text CHECK (cover_url IS NULL OR length(cover_url) <= 2048),
  valid_from timestamptz,
  valid_until timestamptz,
  stock_limit integer CHECK (stock_limit IS NULL OR stock_limit >= 0),
  sold_count integer NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS gift_card_packages_business_idx
  ON public.gift_card_packages (business_id, is_active, display_order);

CREATE TABLE IF NOT EXISTS public.gift_card_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.gift_card_packages(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('service_pass', 'value')),
  -- service_pass: one voucher with `quantity` visits of this treatment
  service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT,
  duration_id uuid REFERENCES public.service_durations(id) ON DELETE RESTRICT,
  -- value: `quantity` separate vouchers worth value_cents each
  value_cents integer CHECK (value_cents IS NULL OR value_cents > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 50),
  label text CHECK (label IS NULL OR length(label) <= 160),
  display_order integer NOT NULL DEFAULT 0,
  CHECK (
    (kind = 'service_pass' AND service_id IS NOT NULL AND duration_id IS NOT NULL AND value_cents IS NULL)
    OR (kind = 'value' AND value_cents IS NOT NULL AND service_id IS NULL AND duration_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS gift_card_package_items_package_idx
  ON public.gift_card_package_items (package_id, display_order);

-- Items must point at the package's own business and treatments.
CREATE OR REPLACE FUNCTION private.check_gift_card_package_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gift_card_packages p WHERE p.id = NEW.package_id AND p.business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'Package does not belong to this business';
  END IF;
  IF NEW.kind = 'service_pass' AND NOT EXISTS (
    SELECT 1 FROM public.service_durations d JOIN public.services s ON s.id = d.service_id
    WHERE d.id = NEW.duration_id AND s.id = NEW.service_id AND s.business_id = NEW.business_id
  ) THEN
    RAISE EXCEPTION 'Treatment and duration must belong to this business';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_gift_card_package_item ON public.gift_card_package_items;
CREATE TRIGGER check_gift_card_package_item
  BEFORE INSERT OR UPDATE ON public.gift_card_package_items
  FOR EACH ROW EXECUTE FUNCTION private.check_gift_card_package_item();

ALTER TABLE public.gift_card_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_package_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active gift card packages" ON public.gift_card_packages;
CREATE POLICY "Public can view active gift card packages"
  ON public.gift_card_packages FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "Admins manage own gift card packages" ON public.gift_card_packages;
CREATE POLICY "Admins manage own gift card packages"
  ON public.gift_card_packages FOR ALL TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (business_id = public.get_admin_business_id());

DROP POLICY IF EXISTS "Public can view items of active packages" ON public.gift_card_package_items;
CREATE POLICY "Public can view items of active packages"
  ON public.gift_card_package_items FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.gift_card_packages p WHERE p.id = package_id AND p.is_active));

DROP POLICY IF EXISTS "Admins manage own gift card package items" ON public.gift_card_package_items;
CREATE POLICY "Admins manage own gift card package items"
  ON public.gift_card_package_items FOR ALL TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (business_id = public.get_admin_business_id());

GRANT SELECT ON public.gift_card_packages, public.gift_card_package_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_card_packages, public.gift_card_package_items TO authenticated;

-- ─── C. Orders (pay in store) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gift_card_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  package_id uuid REFERENCES public.gift_card_packages(id) ON DELETE SET NULL,
  title text NOT NULL,
  total_cents integer NOT NULL CHECK (total_cents > 0),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'cancelled')),
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text,
  recipient_name text,
  recipient_email text,
  message text,
  bonus_note text,
  bonus_handed_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, order_number)
);

CREATE INDEX IF NOT EXISTS gift_card_orders_business_idx
  ON public.gift_card_orders (business_id, status, created_at DESC);

ALTER TABLE public.gift_card_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view own gift card orders" ON public.gift_card_orders;
CREATE POLICY "Admins view own gift card orders"
  ON public.gift_card_orders FOR SELECT TO authenticated
  USING (business_id = public.get_admin_business_id());

GRANT SELECT ON public.gift_card_orders TO authenticated;

ALTER TABLE public.gift_cards
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.gift_card_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gift_cards_order_idx ON public.gift_cards (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE public.gift_cards DROP CONSTRAINT IF EXISTS gift_cards_status_check;
ALTER TABLE public.gift_cards ADD CONSTRAINT gift_cards_status_check
  CHECK (status IN ('active', 'fully_redeemed', 'expired', 'pending_payment', 'cancelled'));

-- ─── D. Promotion note ────────────────────────────────────────────────────────

ALTER TABLE public.gift_card_settings
  ADD COLUMN IF NOT EXISTS promo_title text,
  ADD COLUMN IF NOT EXISTS promo_text text,
  ADD COLUMN IF NOT EXISTS promo_gift_note text,
  ADD COLUMN IF NOT EXISTS promo_gift_min_cents integer,
  ADD COLUMN IF NOT EXISTS promo_gift_min_minutes integer,
  ADD COLUMN IF NOT EXISTS promo_valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS promo_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS pay_in_store_enabled boolean NOT NULL DEFAULT false;

-- ─── Order functions ──────────────────────────────────────────────────────────

/*
  Place an order that the customer pays in the shop. Exactly one of
  p_package_id, p_service_pass_offer_id, p_value_cents is given.
  Returns { order_id, order_number, total_cents, bonus_note }. Codes are not
  returned; the shop hands them out after payment.
*/
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
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN
    RAISE EXCEPTION 'ORDER_INVALID: email';
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
  IF NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.pay_in_store_enabled THEN
    RAISE EXCEPTION 'ORDER_UNAVAILABLE: vouchers cannot be ordered online';
  END IF;

  -- Abuse limits: open orders per email and per shop
  IF (SELECT count(*) FROM public.gift_card_orders o
      WHERE o.business_id = p_business_id AND lower(o.buyer_email) = v_email
        AND o.status = 'pending_payment' AND o.created_at > now() - interval '1 day') >= 5
     OR (SELECT count(*) FROM public.gift_card_orders o
      WHERE o.business_id = p_business_id AND o.created_at > now() - interval '1 hour') >= 60 THEN
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
    IF NOT (
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

REVOKE ALL ON FUNCTION public.place_gift_card_order(uuid, text, text, uuid, uuid, integer, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_gift_card_order(uuid, text, text, uuid, uuid, integer, text, text, text, text) TO anon, authenticated;

-- Shop: customer paid → vouchers become active; validity starts today.
CREATE OR REPLACE FUNCTION public.mark_gift_card_order_paid(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.gift_card_orders%ROWTYPE;
  v_days integer;
  v_count integer;
BEGIN
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
  SELECT g.id, g.purchase_price_cents, 'purchase', 'Bezahlt im Laden · Bestellung ' || v_order.order_number
  FROM public.gift_cards g WHERE g.order_id = v_order.id;

  UPDATE public.gift_card_orders SET status = 'paid', paid_at = now() WHERE id = v_order.id;
  RETURN v_count;
END;
$$;

-- Shop: order not picked up / not paid → vouchers cancelled, stock released.
CREATE OR REPLACE FUNCTION public.cancel_gift_card_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.gift_card_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.gift_card_orders
  WHERE id = p_order_id AND business_id = public.get_admin_business_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Only unpaid orders can be cancelled';
  END IF;

  UPDATE public.gift_cards SET status = 'cancelled', updated_at = now()
  WHERE order_id = v_order.id AND status = 'pending_payment';
  IF v_order.package_id IS NOT NULL THEN
    UPDATE public.gift_card_packages SET sold_count = greatest(sold_count - 1, 0), updated_at = now()
    WHERE id = v_order.package_id;
  END IF;
  UPDATE public.gift_card_orders SET status = 'cancelled', cancelled_at = now() WHERE id = v_order.id;
END;
$$;

-- Shop: the bonus gift / handbag was handed over (or undo).
CREATE OR REPLACE FUNCTION public.set_gift_card_order_bonus_handed(p_order_id uuid, p_handed boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.gift_card_orders
  SET bonus_handed_at = CASE WHEN p_handed THEN now() ELSE NULL END
  WHERE id = p_order_id AND business_id = public.get_admin_business_id();
$$;

REVOKE ALL ON FUNCTION public.mark_gift_card_order_paid(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_gift_card_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_gift_card_order_bonus_handed(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_gift_card_order_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_gift_card_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_gift_card_order_bonus_handed(uuid, boolean) TO authenticated;
