/*
  Customer blocklist + tidy-up of duplicate customers (Jev 2026-11-19).

  Blocklist
  - customers.blocked_at / blocked_reason / blocked_by, set through
    set_customer_blocked(). Internal only: the customer never sees the reason.
  - Online bookings (widget, chat, agent API) from a blocked email or phone are
    refused with BOOKING_BLOCKED. Shop staff can still book them by hand.

  Merge ("aliases, no rewrite")
  - merge_customers() keeps one customer, moves everything that points at the
    others (notes, loyalty, gift cards, consents, ...) and remembers their
    emails and phone numbers in customer_email_aliases / customer_phone_aliases
    ("also known as"). Old bookings keep the email they were
    made with (GoBD); stats and new bookings find the kept customer via the
    aliases, so the duplicate does not come back.
  - customer_duplicate_dismissals: groups the shop marked "not the same person".
*/

-- 1. Blocklist columns -------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_by uuid;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_blocked_reason_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_blocked_reason_check
  CHECK (blocked_reason IS NULL OR char_length(blocked_reason) <= 500);

-- 2. Merged emails and dismissed duplicate pairs -------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_email_aliases (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email_key text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, email_key)
);
CREATE INDEX IF NOT EXISTS idx_customer_email_aliases_customer ON public.customer_email_aliases(customer_id);

-- Other phone numbers of a merged customer ("also known as"). Not unique per shop:
-- family members may share a number.
CREATE TABLE IF NOT EXISTS public.customer_phone_aliases (
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone_key text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, phone_key)
);
CREATE INDEX IF NOT EXISTS idx_customer_phone_aliases_lookup ON public.customer_phone_aliases(business_id, phone_key);

CREATE TABLE IF NOT EXISTS public.customer_duplicate_dismissals (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_a uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_b uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (business_id, customer_a, customer_b),
  CHECK (customer_a < customer_b)
);

ALTER TABLE public.customer_email_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_phone_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_duplicate_dismissals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_email_aliases, public.customer_phone_aliases, public.customer_duplicate_dismissals FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.customer_email_aliases, public.customer_phone_aliases, public.customer_duplicate_dismissals FROM authenticated;

DROP POLICY IF EXISTS "Admins read own customer aliases" ON public.customer_email_aliases;
CREATE POLICY "Admins read own customer aliases" ON public.customer_email_aliases
  FOR SELECT TO authenticated USING (business_id = get_admin_business_id());
DROP POLICY IF EXISTS "Admins read own customer phone aliases" ON public.customer_phone_aliases;
CREATE POLICY "Admins read own customer phone aliases" ON public.customer_phone_aliases
  FOR SELECT TO authenticated USING (business_id = get_admin_business_id());
DROP POLICY IF EXISTS "Admins read own duplicate dismissals" ON public.customer_duplicate_dismissals;
CREATE POLICY "Admins read own duplicate dismissals" ON public.customer_duplicate_dismissals
  FOR SELECT TO authenticated USING (business_id = get_admin_business_id());

-- 3. Matching helpers ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.email_key(p_email text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT NULLIF(lower(btrim(p_email)), '') $$;

-- German numbers in one shape: +49 176 1234567, 0049..., 0176-1234567 -> 01761234567.
CREATE OR REPLACE FUNCTION private.phone_key(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  WITH digits AS (
    SELECT CASE
             WHEN btrim(p_phone) LIKE '+%' THEN '00' || regexp_replace(p_phone, '\D', '', 'g')
             ELSE regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')
           END AS d
  ), local AS (
    SELECT CASE WHEN d LIKE '0049%' THEN '0' || substr(d, 5) ELSE d END AS d FROM digits
  )
  SELECT CASE WHEN length(d) >= 6 THEN d END FROM local
$$;

-- The customer a booking email belongs to: the customer's own email first, then merged emails.
CREATE OR REPLACE FUNCTION private.customer_id_for_email(p_business_id uuid, p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT c.id FROM public.customers c
      WHERE c.business_id = p_business_id AND private.email_key(c.email) = private.email_key(p_email)
      ORDER BY c.created_at LIMIT 1),
    (SELECT a.customer_id FROM public.customer_email_aliases a
      WHERE a.business_id = p_business_id AND a.email_key = private.email_key(p_email))
  )
$$;

CREATE OR REPLACE FUNCTION private.is_contact_blocked(p_business_id uuid, p_email text, p_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers c
     WHERE c.business_id = p_business_id AND c.blocked_at IS NOT NULL
       AND (c.id = private.customer_id_for_email(p_business_id, p_email)
            OR (private.phone_key(p_phone) IS NOT NULL AND (
                  private.phone_key(c.phone) = private.phone_key(p_phone)
                  OR EXISTS (SELECT 1 FROM public.customer_phone_aliases pa
                              WHERE pa.customer_id = c.id AND pa.phone_key = private.phone_key(p_phone)))))
  )
$$;

REVOKE ALL ON FUNCTION private.email_key(text), private.phone_key(text),
  private.customer_id_for_email(uuid, text), private.is_contact_blocked(uuid, text, text) FROM PUBLIC;

-- 4. Refuse online bookings from blocked customers -----------------------------------
CREATE OR REPLACE FUNCTION private.refuse_blocked_online_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  -- Shop staff may always book by hand; the block is only for online channels.
  IF private.is_business_admin(NEW.business_id) THEN
    RETURN NEW;
  END IF;
  IF private.is_contact_blocked(NEW.business_id, NEW.customer_email, NEW.customer_phone) THEN
    RAISE EXCEPTION 'BOOKING_BLOCKED: Online booking is not possible. Please contact the shop directly.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.refuse_blocked_online_booking() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_refuse_blocked_online_booking ON public.bookings;
CREATE TRIGGER a_refuse_blocked_online_booking
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.refuse_blocked_online_booking();

-- AI agents first hold a slot; refuse there already, not only at the final confirm.
DROP TRIGGER IF EXISTS a_refuse_blocked_online_booking ON public.slot_holds;
CREATE TRIGGER a_refuse_blocked_online_booking
  BEFORE INSERT ON public.slot_holds
  FOR EACH ROW EXECUTE FUNCTION private.refuse_blocked_online_booking();

-- 5. A merged email never becomes a separate customer again ---------------------------
CREATE OR REPLACE FUNCTION private.skip_customer_for_merged_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.customer_email_aliases a
              WHERE a.business_id = NEW.business_id AND a.email_key = private.email_key(NEW.email)) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.skip_customer_for_merged_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_skip_customer_for_merged_email ON public.customers;
CREATE TRIGGER a_skip_customer_for_merged_email
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION private.skip_customer_for_merged_email();

-- 6. Booking -> customer triggers follow merged emails ---------------------------------
CREATE OR REPLACE FUNCTION public.upsert_customer_from_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  booking_total integer;
  v_alias_customer uuid;
BEGIN
  SELECT d.price_cents INTO booking_total FROM service_durations d WHERE d.id = NEW.duration_id;

  SELECT a.customer_id INTO v_alias_customer FROM customer_email_aliases a
   WHERE a.business_id = NEW.business_id AND a.email_key = private.email_key(NEW.customer_email);

  IF v_alias_customer IS NOT NULL THEN
    -- Merged email: count on the kept customer; keep the name and phone the shop chose.
    UPDATE customers SET
      phone = COALESCE(phone, NEW.customer_phone),
      total_bookings = total_bookings + 1,
      total_spent_cents = total_spent_cents + COALESCE(booking_total, 0),
      last_visit_date = GREATEST(last_visit_date, NEW.booking_date),
      first_visit_date = LEAST(first_visit_date, NEW.booking_date),
      updated_at = now()
    WHERE id = v_alias_customer;
    RETURN NEW;
  END IF;

  INSERT INTO customers (business_id, name, email, phone, total_bookings, total_spent_cents, first_visit_date, last_visit_date)
  VALUES (NEW.business_id, NEW.customer_name, NEW.customer_email, NEW.customer_phone, 1, COALESCE(booking_total, 0),
          NEW.booking_date, NEW.booking_date)
  ON CONFLICT (business_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    total_bookings = customers.total_bookings + 1,
    total_spent_cents = customers.total_spent_cents + COALESCE(booking_total, 0),
    last_visit_date = CASE WHEN EXCLUDED.last_visit_date > customers.last_visit_date THEN EXCLUDED.last_visit_date ELSE customers.last_visit_date END,
    first_visit_date = CASE WHEN EXCLUDED.first_visit_date < customers.first_visit_date THEN EXCLUDED.first_visit_date ELSE customers.first_visit_date END,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.capture_marketing_from_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_needs_confirm boolean := false;
  v_customer_id uuid;
BEGIN
  IF NEW.customer_email IS NULL OR (NEW.customer_birthday IS NULL AND NOT NEW.newsletter_opt_in) THEN
    RETURN NEW;
  END IF;
  v_customer_id := private.customer_id_for_email(NEW.business_id, NEW.customer_email);

  IF NEW.customer_birthday IS NOT NULL THEN
    UPDATE public.customers SET birthday = NEW.customer_birthday WHERE id = v_customer_id;
  END IF;

  IF NEW.newsletter_opt_in THEN
    WITH changed AS (
      UPDATE public.customers
         SET newsletter_status = 'pending', newsletter_changed_at = now(), newsletter_consent_source = 'booking_form'
       WHERE id = v_customer_id
         AND newsletter_status IS DISTINCT FROM 'subscribed'
      RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM changed) INTO v_needs_confirm;
    -- The outbox row needs a date and time (snapshot columns are NOT NULL).
    IF v_needs_confirm AND NEW.booking_date IS NOT NULL AND NEW.start_time IS NOT NULL THEN
      PERFORM private.queue_notification(NEW, 'newsletter_confirm');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 7. Stats count bookings made under merged emails too ----------------------------------
CREATE OR REPLACE VIEW public.customer_stats
WITH (security_invoker = true) AS
WITH classified AS (
  SELECT
    b.business_id,
    lower(btrim(b.customer_email)) AS email_key,
    b.booking_date,
    CASE
      WHEN b.no_show THEN 'no_show'
      WHEN b.status = 'cancelled' THEN 'cancelled'
      WHEN b.status = 'completed' OR (b.status = 'confirmed' AND b.booking_date < current_date) THEN 'visit'
      ELSE 'upcoming'
    END AS outcome,
    COALESCE(b.final_amount_cents, b.total_price_cents, d.price_cents, 0) AS amount_cents
  FROM public.bookings b
  LEFT JOIN public.service_durations d ON d.id = b.duration_id
), customer_keys AS (
  SELECT c.id AS customer_id, c.business_id, lower(btrim(c.email)) AS email_key FROM public.customers c
  UNION
  SELECT a.customer_id, a.business_id, a.email_key FROM public.customer_email_aliases a
)
SELECT
  c.id AS customer_id,
  c.business_id,
  count(k.email_key)::int AS total_count,
  count(*) FILTER (WHERE k.outcome = 'visit')::int AS visits_count,
  count(*) FILTER (WHERE k.outcome = 'no_show')::int AS no_show_count,
  count(*) FILTER (WHERE k.outcome = 'cancelled')::int AS cancelled_count,
  count(*) FILTER (WHERE k.outcome = 'upcoming')::int AS upcoming_count,
  COALESCE(sum(k.amount_cents) FILTER (WHERE k.outcome = 'visit'), 0)::int AS spent_cents,
  min(k.booking_date) FILTER (WHERE k.outcome = 'visit') AS first_visit_date,
  max(k.booking_date) FILTER (WHERE k.outcome = 'visit') AS last_visit_date
FROM public.customers c
LEFT JOIN customer_keys ck ON ck.customer_id = c.id
LEFT JOIN classified k
  ON k.business_id = c.business_id
 AND k.email_key = ck.email_key
GROUP BY c.id, c.business_id;

-- 8. Block / unblock -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_customer_blocked(p_customer_id uuid, p_blocked boolean, p_reason text DEFAULT NULL)
RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_customer public.customers;
BEGIN
  SELECT * INTO v_customer FROM public.customers WHERE id = p_customer_id;
  IF NOT FOUND OR NOT private.is_business_admin(v_customer.business_id) THEN
    RAISE EXCEPTION 'Customer not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.customers SET
    blocked_at = CASE WHEN p_blocked THEN COALESCE(blocked_at, now()) END,
    blocked_reason = CASE WHEN p_blocked THEN NULLIF(left(btrim(COALESCE(p_reason, '')), 500), '') END,
    blocked_by = CASE WHEN p_blocked THEN auth.uid() END,
    updated_at = now()
  WHERE id = p_customer_id
  RETURNING * INTO v_customer;
  RETURN v_customer;
END;
$function$;
REVOKE ALL ON FUNCTION public.set_customer_blocked(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_blocked(uuid, boolean, text) TO authenticated;

-- Staff see a "Blocked" badge on the booking popup (same rule as the booking guard).
CREATE OR REPLACE FUNCTION public.booking_contact_blocked(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT private.is_contact_blocked(b.business_id, b.customer_email, b.customer_phone)
      FROM public.bookings b
     WHERE b.id = p_booking_id AND private.is_business_admin(b.business_id)
  ), false)
$$;
REVOKE ALL ON FUNCTION public.booking_contact_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_contact_blocked(uuid) TO authenticated;

-- 9. "Not the same person" -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dismiss_customer_duplicates(p_customer_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_business_id uuid;
BEGIN
  IF cardinality(p_customer_ids) NOT BETWEEN 2 AND 20 THEN
    RAISE EXCEPTION 'Choose 2 to 20 customers' USING ERRCODE = '22023';
  END IF;
  SELECT min(business_id::text)::uuid INTO v_business_id FROM public.customers WHERE id = ANY(p_customer_ids)
  HAVING count(DISTINCT business_id) = 1 AND count(*) = cardinality(p_customer_ids);
  IF v_business_id IS NULL OR NOT private.is_business_admin(v_business_id) THEN
    RAISE EXCEPTION 'Customers not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.customer_duplicate_dismissals (business_id, customer_a, customer_b, created_by)
  SELECT v_business_id, a, b, auth.uid()
    FROM unnest(p_customer_ids) a, unnest(p_customer_ids) b
   WHERE a < b
  ON CONFLICT DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.dismiss_customer_duplicates(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_customer_duplicates(uuid[]) TO authenticated;

-- "Also known as": the shop removes an email or phone that does not belong to this customer.
-- A removed email no longer finds this customer; its next booking creates its own customer.
CREATE OR REPLACE FUNCTION public.remove_customer_alias(p_customer_id uuid, p_kind text, p_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_business_id uuid;
BEGIN
  SELECT business_id INTO v_business_id FROM public.customers WHERE id = p_customer_id;
  IF v_business_id IS NULL OR NOT private.is_business_admin(v_business_id) THEN
    RAISE EXCEPTION 'Customer not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_kind = 'email' THEN
    DELETE FROM public.customer_email_aliases WHERE customer_id = p_customer_id AND email_key = p_key;
  ELSIF p_kind = 'phone' THEN
    DELETE FROM public.customer_phone_aliases WHERE customer_id = p_customer_id AND phone_key = p_key;
  ELSE
    RAISE EXCEPTION 'Kind must be email or phone' USING ERRCODE = '22023';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.remove_customer_alias(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_customer_alias(uuid, text, text) TO authenticated;

-- 10. Merge ------------------------------------------------------------------------------------
/*
  Keeps p_keep_id, folds p_other_ids into it and deletes them.
  p_name / p_phone: what the shop picked. p_email: which of the customers' emails
  stays the main one (the others become aliases).
  Every table with a foreign key to customers is moved over; tables with a
  unique key per customer keep one row (the kept customer's, or the stricter
  consent). If an unknown table still points at a merged customer, the merge
  stops instead of letting ON DELETE CASCADE drop data.
*/
CREATE OR REPLACE FUNCTION public.merge_customers(
  p_keep_id uuid,
  p_other_ids uuid[],
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL
)
RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_keep public.customers;
  v_all uuid[];
  v_business_id uuid;
  v_main_email text;
  v_fk record;
  v_left boolean;
  v_keep_old_phone text;
BEGIN
  IF p_other_ids IS NULL OR cardinality(p_other_ids) NOT BETWEEN 1 AND 19 OR p_keep_id = ANY(p_other_ids) THEN
    RAISE EXCEPTION 'Choose the customer to keep and 1 to 19 others' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(btrim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Name is required' USING ERRCODE = '22023';
  END IF;
  v_all := array_append(p_other_ids, p_keep_id);

  -- Lock all rows; all must exist and belong to one shop the caller runs.
  PERFORM 1 FROM public.customers WHERE id = ANY(v_all) FOR UPDATE;
  SELECT min(business_id::text)::uuid INTO v_business_id FROM public.customers WHERE id = ANY(v_all)
  HAVING count(DISTINCT business_id) = 1 AND count(*) = cardinality(v_all);
  IF v_business_id IS NULL OR NOT private.is_business_admin(v_business_id) THEN
    RAISE EXCEPTION 'Customers not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.email INTO v_main_email FROM public.customers c
   WHERE c.id = ANY(v_all) AND private.email_key(c.email) = private.email_key(p_email) LIMIT 1;
  IF v_main_email IS NULL THEN
    RAISE EXCEPTION 'The main email must be one of the customers'' emails' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT user_id) FROM public.customers WHERE id = ANY(v_all) AND user_id IS NOT NULL) > 1 THEN
    RAISE EXCEPTION 'Two of these customers have their own login and cannot be merged' USING ERRCODE = 'P0001';
  END IF;

  SELECT phone INTO v_keep_old_phone FROM public.customers WHERE id = p_keep_id;

  -- Fields of the kept customer: picked by the shop, else the stricter / known value.
  UPDATE public.customers k SET
    name = left(btrim(p_name), 200),
    phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
    birthday = COALESCE(k.birthday, o.birthday),
    user_id = COALESCE(k.user_id, o.user_id),
    preferred_language = COALESCE(k.preferred_language, o.preferred_language),
    newsletter_status = CASE
      WHEN 'unsubscribed' IN (k.newsletter_status, o.any_unsubscribed) THEN 'unsubscribed'
      ELSE COALESCE(k.newsletter_status, o.newsletter_status) END,
    newsletter_changed_at = COALESCE(k.newsletter_changed_at, o.newsletter_changed_at),
    newsletter_consent_source = COALESCE(k.newsletter_consent_source, o.newsletter_consent_source),
    blocked_at = COALESCE(k.blocked_at, o.blocked_at),
    blocked_reason = CASE WHEN k.blocked_at IS NOT NULL THEN k.blocked_reason ELSE o.blocked_reason END,
    blocked_by = CASE WHEN k.blocked_at IS NOT NULL THEN k.blocked_by ELSE o.blocked_by END,
    total_bookings = COALESCE(k.total_bookings, 0) + o.total_bookings,
    total_spent_cents = COALESCE(k.total_spent_cents, 0) + o.total_spent_cents,
    first_visit_date = LEAST(k.first_visit_date, o.first_visit_date),
    last_visit_date = GREATEST(k.last_visit_date, o.last_visit_date),
    updated_at = now()
  FROM (
    SELECT
      (array_agg(birthday) FILTER (WHERE birthday IS NOT NULL))[1] AS birthday,
      (array_agg(user_id) FILTER (WHERE user_id IS NOT NULL))[1] AS user_id,
      (array_agg(preferred_language) FILTER (WHERE preferred_language IS NOT NULL))[1] AS preferred_language,
      CASE WHEN bool_or(newsletter_status = 'unsubscribed') THEN 'unsubscribed' END AS any_unsubscribed,
      (array_agg(newsletter_status ORDER BY newsletter_changed_at DESC NULLS LAST) FILTER (WHERE newsletter_status IS NOT NULL))[1] AS newsletter_status,
      max(newsletter_changed_at) AS newsletter_changed_at,
      (array_agg(newsletter_consent_source) FILTER (WHERE newsletter_consent_source IS NOT NULL))[1] AS newsletter_consent_source,
      (array_agg(blocked_at ORDER BY blocked_at) FILTER (WHERE blocked_at IS NOT NULL))[1] AS blocked_at,
      (array_agg(blocked_reason ORDER BY blocked_at) FILTER (WHERE blocked_at IS NOT NULL))[1] AS blocked_reason,
      (array_agg(blocked_by ORDER BY blocked_at) FILTER (WHERE blocked_at IS NOT NULL))[1] AS blocked_by,
      COALESCE(sum(total_bookings), 0)::int AS total_bookings,
      COALESCE(sum(total_spent_cents), 0)::int AS total_spent_cents,
      min(first_visit_date) AS first_visit_date,
      max(last_visit_date) AS last_visit_date
    FROM public.customers WHERE id = ANY(p_other_ids)
  ) o
  WHERE k.id = p_keep_id;

  -- Tables with one row per customer: keep one row, then the generic move below is conflict-free.
  INSERT INTO public.loyalty_points (customer_id, points_balance, points_earned_total, points_redeemed_total)
  SELECT p_keep_id, sum(points_balance), sum(points_earned_total), sum(points_redeemed_total)
    FROM public.loyalty_points WHERE customer_id = ANY(v_all)
  HAVING count(*) > 0
  ON CONFLICT (customer_id) DO UPDATE SET
    points_balance = EXCLUDED.points_balance,
    points_earned_total = EXCLUDED.points_earned_total,
    points_redeemed_total = EXCLUDED.points_redeemed_total,
    updated_at = now();
  DELETE FROM public.loyalty_points WHERE customer_id = ANY(p_other_ids);

  DELETE FROM public.customer_gift_cards x WHERE x.customer_id = ANY(p_other_ids) AND EXISTS (
    SELECT 1 FROM public.customer_gift_cards y WHERE y.gift_card_id = x.gift_card_id AND y.customer_id = ANY(v_all)
      AND (y.customer_id = p_keep_id OR y.id < x.id) AND y.id <> x.id);
  DELETE FROM public.marketing_sends x WHERE x.customer_id = ANY(p_other_ids) AND EXISTS (
    SELECT 1 FROM public.marketing_sends y WHERE y.campaign_id = x.campaign_id AND y.run_key = x.run_key
      AND y.customer_id = ANY(v_all) AND (y.customer_id = p_keep_id OR y.id < x.id) AND y.id <> x.id);
  DELETE FROM public.outreach_recipients x WHERE x.customer_id = ANY(p_other_ids) AND EXISTS (
    SELECT 1 FROM public.outreach_recipients y WHERE y.campaign_id = x.campaign_id
      AND y.customer_id = ANY(v_all) AND (y.customer_id = p_keep_id OR y.id < x.id) AND y.id <> x.id);
  -- Consent per channel: a revoked consent always wins, otherwise the most recent one.
  DELETE FROM public.customer_contact_consents x WHERE x.customer_id = ANY(v_all) AND x.id <> (
    SELECT y.id FROM public.customer_contact_consents y
     WHERE y.business_id = x.business_id AND y.channel = x.channel AND y.customer_id = ANY(v_all)
     ORDER BY (y.status = 'revoked') DESC, y.recorded_at DESC, y.id LIMIT 1);
  DELETE FROM public.customer_duplicate_dismissals
   WHERE customer_a = ANY(p_other_ids) OR customer_b = ANY(p_other_ids);

  -- Remember the merged emails (and the ones merged into them before).
  INSERT INTO public.customer_email_aliases (business_id, email_key, customer_id)
  SELECT v_business_id, private.email_key(c.email), p_keep_id FROM public.customers c
   WHERE c.id = ANY(p_other_ids) AND private.email_key(c.email) IS NOT NULL
  ON CONFLICT (business_id, email_key) DO UPDATE SET customer_id = EXCLUDED.customer_id;

  -- Remember the other phone numbers; the one the shop picked stays the main one.
  INSERT INTO public.customer_phone_aliases (customer_id, business_id, phone_key, phone)
  SELECT DISTINCT ON (private.phone_key(p.phone)) p_keep_id, v_business_id, private.phone_key(p.phone), btrim(p.phone)
    FROM (
      SELECT c.phone FROM public.customers c WHERE c.id = ANY(p_other_ids)
      UNION ALL SELECT v_keep_old_phone
      UNION ALL SELECT pa.phone FROM public.customer_phone_aliases pa WHERE pa.customer_id = ANY(p_other_ids)
    ) p
   WHERE private.phone_key(p.phone) IS NOT NULL
     AND private.phone_key(p.phone) IS DISTINCT FROM private.phone_key(p_phone)
  ON CONFLICT (customer_id, phone_key) DO NOTHING;
  DELETE FROM public.customer_phone_aliases
   WHERE customer_id = ANY(p_other_ids)
      OR (customer_id = p_keep_id AND phone_key = private.phone_key(p_phone));

  -- Every other table that points at a customer moves to the kept one.
  FOR v_fk IN
    SELECT n.nspname AS schema_name, t.relname AS table_name, a.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class t ON t.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND con.confrelid = 'public.customers'::regclass AND cardinality(con.conkey) = 1
       AND t.relname <> 'customer_duplicate_dismissals'
  LOOP
    EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = ANY($2)', v_fk.schema_name, v_fk.table_name, v_fk.column_name, v_fk.column_name)
      USING p_keep_id, p_other_ids;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = ANY($1))', v_fk.schema_name, v_fk.table_name, v_fk.column_name)
      INTO v_left USING p_other_ids;
    IF v_left THEN
      RAISE EXCEPTION 'Merge stopped: % still points at a merged customer', v_fk.table_name USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  DELETE FROM public.customers WHERE id = ANY(p_other_ids);

  -- The main email the shop picked; the kept customer's old email becomes an alias.
  SELECT * INTO v_keep FROM public.customers WHERE id = p_keep_id;
  IF private.email_key(v_keep.email) IS DISTINCT FROM private.email_key(v_main_email) THEN
    DELETE FROM public.customer_email_aliases WHERE business_id = v_business_id AND email_key = private.email_key(v_main_email);
    INSERT INTO public.customer_email_aliases (business_id, email_key, customer_id)
    VALUES (v_business_id, private.email_key(v_keep.email), p_keep_id)
    ON CONFLICT (business_id, email_key) DO UPDATE SET customer_id = EXCLUDED.customer_id;
    UPDATE public.customers SET email = v_main_email WHERE id = p_keep_id RETURNING * INTO v_keep;
  END IF;

  RETURN v_keep;
END;
$function$;
REVOKE ALL ON FUNCTION public.merge_customers(uuid, uuid[], text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid[], text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
