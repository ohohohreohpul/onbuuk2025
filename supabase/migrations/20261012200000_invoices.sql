/*
  Invoices for German shops (Jev order 2026-10-12, item 6: PDF + numbering +
  tax data first, ZUGFeRD/XRechnung later).

  - Shop tax data on businesses: legal name, Steuernummer, USt-IdNr,
    Kleinunternehmer (§19 UStG), default VAT rate, invoice prefix, footer.
  - public.invoices: one per booking, immutable snapshot of seller, customer,
    lines and totals (prices are gross, B2C). Numbers are gap-free per shop and
    year ("RE-2026-0001"), issued only through issue_booking_invoice().
  - Admins of the shop can read their invoices; nobody writes them directly.
*/

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS tax_number text,
  ADD COLUMN IF NOT EXISTS vat_id text,
  ADD COLUMN IF NOT EXISTS is_small_business boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_vat_bps integer NOT NULL DEFAULT 1900,
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'RE',
  ADD COLUMN IF NOT EXISTS invoice_footer text;

DO $$ BEGIN
  ALTER TABLE public.businesses ADD CONSTRAINT businesses_default_vat_bps_check CHECK (default_vat_bps IN (0, 700, 1900));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.businesses ADD CONSTRAINT businesses_invoice_prefix_check CHECK (invoice_prefix ~ '^[A-Za-z0-9-]{1,10}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS private.invoice_counters (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, year)
);
REVOKE ALL ON private.invoice_counters FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  booking_id uuid UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  service_date date,
  seller jsonb NOT NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_address text,
  items jsonb NOT NULL,
  vat_bps integer NOT NULL,
  is_small_business boolean NOT NULL,
  net_cents integer NOT NULL,
  vat_cents integer NOT NULL,
  gross_cents integer NOT NULL,
  paid_with_voucher_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  created_by uuid,
  UNIQUE (business_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoices FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM authenticated;
DROP POLICY IF EXISTS "Admins read own invoices" ON public.invoices;
CREATE POLICY "Admins read own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (business_id = get_admin_business_id());

-- Gross -> net/VAT split for one rate, rounded to the cent.
CREATE OR REPLACE FUNCTION private.split_gross(p_gross_cents integer, p_vat_bps integer)
RETURNS TABLE (net_cents integer, vat_cents integer)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT round(p_gross_cents * 10000.0 / (10000 + p_vat_bps))::int,
         p_gross_cents - round(p_gross_cents * 10000.0 / (10000 + p_vat_bps))::int;
$$;

CREATE OR REPLACE FUNCTION public.issue_booking_invoice(p_booking_id uuid, p_customer_address text DEFAULT NULL)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_invoice public.invoices;
  v_booking record;
  v_business public.businesses;
  v_year integer := extract(year FROM now() AT TIME ZONE 'Europe/Berlin')::int;
  v_number integer;
  v_vat_bps integer;
  v_items jsonb;
  v_gross integer;
  v_currency text;
BEGIN
  SELECT b.*, s.name AS service_name, d.duration_minutes, d.price_cents AS duration_price
    INTO v_booking
  FROM public.bookings b
  LEFT JOIN public.services s ON s.id = b.service_id
  LEFT JOIN public.service_durations d ON d.id = b.duration_id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.is_business_admin(v_booking.business_id) THEN
    RAISE EXCEPTION 'Only the shop can issue invoices' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status = 'cancelled' AND NOT COALESCE(v_booking.no_show, false) THEN
    RAISE EXCEPTION 'Cancelled bookings get no invoice' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN v_invoice;  -- one invoice per booking; reprint instead of renumbering
  END IF;

  SELECT * INTO v_business FROM public.businesses WHERE id = v_booking.business_id;
  IF COALESCE(trim(v_business.tax_number), '') = '' AND COALESCE(trim(v_business.vat_id), '') = '' THEN
    RAISE EXCEPTION 'Add your Steuernummer or USt-IdNr in Settings › Invoices first.' USING ERRCODE = 'P0001';
  END IF;
  v_vat_bps := CASE WHEN v_business.is_small_business THEN 0 ELSE v_business.default_vat_bps END;
  SELECT upper(NULLIF(trim(both '"' from s.value), '')) INTO v_currency
  FROM public.site_settings s WHERE s.business_id = v_business.id AND s.key = 'currency';

  -- Lines: treatment (+ add-ons), gross prices.
  SELECT jsonb_agg(line ORDER BY ord) INTO v_items FROM (
    SELECT 0 AS ord, jsonb_build_object(
      'description', concat_ws(' ', v_booking.service_name, CASE WHEN v_booking.duration_minutes IS NOT NULL THEN '(' || v_booking.duration_minutes || ' Min.)' END,
                               CASE WHEN v_booking.is_pair_booking THEN '· Paarbehandlung' END),
      'quantity', 1,
      'unit_gross_cents', COALESCE(v_booking.total_price_cents, v_booking.duration_price, 0),
      'vat_bps', v_vat_bps) AS line
    UNION ALL
    SELECT 1, jsonb_build_object(
      'description', COALESCE(p.name, 'Zusatzleistung'),
      'quantity', bp.quantity,
      'unit_gross_cents', bp.price_cents,
      'vat_bps', v_vat_bps)
    FROM public.booking_products bp
    LEFT JOIN public.products p ON p.id = bp.product_id
    WHERE bp.booking_id = p_booking_id
  ) lines;

  SELECT COALESCE(sum((l->>'quantity')::int * (l->>'unit_gross_cents')::int), 0)::int INTO v_gross
  FROM jsonb_array_elements(v_items) l;

  INSERT INTO private.invoice_counters (business_id, year, last_number) VALUES (v_business.id, v_year, 1)
  ON CONFLICT (business_id, year) DO UPDATE SET last_number = private.invoice_counters.last_number + 1
  RETURNING last_number INTO v_number;

  INSERT INTO public.invoices (
    business_id, booking_id, invoice_number, service_date, seller, customer_name, customer_email, customer_address,
    items, vat_bps, is_small_business, net_cents, vat_cents, gross_cents, paid_with_voucher_cents, currency, created_by)
  SELECT v_business.id, p_booking_id,
    v_business.invoice_prefix || '-' || v_year || '-' || lpad(v_number::text, 4, '0'),
    v_booking.booking_date,
    jsonb_build_object(
      'name', COALESCE(NULLIF(v_business.legal_name, ''), v_business.name),
      'address', concat_ws(', ', NULLIF(v_business.address_line, ''), NULLIF(v_business.city, ''), NULLIF(v_business.address, '')),
      'phone', v_business.phone,
      'tax_number', v_business.tax_number,
      'vat_id', v_business.vat_id,
      'footer', v_business.invoice_footer),
    v_booking.customer_name, v_booking.customer_email, NULLIF(trim(p_customer_address), ''),
    v_items, v_vat_bps, v_business.is_small_business,
    s.net_cents, s.vat_cents, v_gross,
    LEAST(COALESCE(v_booking.gift_card_amount_cents, 0), v_gross),
    COALESCE(v_currency, 'EUR'), auth.uid()
  FROM private.split_gross(v_gross, v_vat_bps) s
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_booking_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_booking_invoice(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION private.split_gross(integer, integer) FROM PUBLIC;
