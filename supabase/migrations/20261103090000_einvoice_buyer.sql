/*
  E-Rechnung (ZUGFeRD / EN 16931), step 1: business customers on invoices.

  From 2027/2028 an invoice to a company over 250 € must be an e-invoice. The
  PDF stays as it is; the browser embeds the EN 16931 XML into it. That XML
  needs the buyer as structured data, so invoices get an immutable snapshot:

    buyer = { company, vat_id, reference, street, postcode, city, country }

  `reference` is the Käuferreferenz (BT-10): Leitweg-ID for public bodies or
  the buyer's order number. NULL buyer = private customer, as before.

  issue_booking_invoice() takes the buyer as a third, optional argument. The
  two-argument version is dropped so PostgREST never sees two overloads; old
  clients calling with two named arguments resolve to the new one.
*/

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS buyer jsonb;

-- Cleans and checks the buyer the shop typed in. Returns NULL for "no company".
CREATE OR REPLACE FUNCTION private.invoice_buyer(p_buyer jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_buyer jsonb;
BEGIN
  IF p_buyer IS NULL OR jsonb_typeof(p_buyer) <> 'object' OR COALESCE(trim(p_buyer->>'company'), '') = '' THEN
    RETURN NULL;
  END IF;

  v_buyer := jsonb_strip_nulls(jsonb_build_object(
    'company', left(trim(p_buyer->>'company'), 200),
    'vat_id', NULLIF(upper(regexp_replace(COALESCE(p_buyer->>'vat_id', ''), '\s', '', 'g')), ''),
    'reference', NULLIF(left(trim(COALESCE(p_buyer->>'reference', '')), 100), ''),
    'street', NULLIF(left(trim(COALESCE(p_buyer->>'street', '')), 200), ''),
    'postcode', NULLIF(left(trim(COALESCE(p_buyer->>'postcode', '')), 10), ''),
    'city', NULLIF(left(trim(COALESCE(p_buyer->>'city', '')), 100), ''),
    'country', upper(COALESCE(NULLIF(trim(p_buyer->>'country'), ''), 'DE'))
  ));

  IF v_buyer->>'country' !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Country must be a two-letter code such as DE.' USING ERRCODE = '22023';
  END IF;
  IF v_buyer ? 'vat_id' AND v_buyer->>'vat_id' !~ '^[A-Z]{2}[0-9A-Z+*.]{2,12}$' THEN
    RAISE EXCEPTION 'USt-IdNr. looks wrong (e.g. DE123456789).' USING ERRCODE = '22023';
  END IF;
  IF NOT (v_buyer ? 'street' AND v_buyer ? 'postcode' AND v_buyer ? 'city') THEN
    RAISE EXCEPTION 'A company invoice needs street, postcode and city.' USING ERRCODE = '22023';
  END IF;
  RETURN v_buyer;
END;
$$;
REVOKE ALL ON FUNCTION private.invoice_buyer(jsonb) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.issue_booking_invoice(uuid, text);

CREATE OR REPLACE FUNCTION public.issue_booking_invoice(
  p_booking_id uuid,
  p_customer_address text DEFAULT NULL,
  p_buyer jsonb DEFAULT NULL
)
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
  v_buyer jsonb;
  v_address text;
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

  v_buyer := private.invoice_buyer(p_buyer);
  v_address := COALESCE(
    NULLIF(trim(p_customer_address), ''),
    CASE WHEN v_buyer IS NOT NULL THEN concat_ws(', ', v_buyer->>'street', concat_ws(' ', v_buyer->>'postcode', v_buyer->>'city'),
      CASE WHEN v_buyer->>'country' <> 'DE' THEN v_buyer->>'country' END) END);

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
    buyer, items, vat_bps, is_small_business, net_cents, vat_cents, gross_cents, paid_with_voucher_cents, currency, created_by)
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
    v_booking.customer_name, v_booking.customer_email, v_address,
    v_buyer, v_items, v_vat_bps, v_business.is_small_business,
    s.net_cents, s.vat_cents, v_gross,
    LEAST(COALESCE(v_booking.gift_card_amount_cents, 0), v_gross),
    COALESCE(v_currency, 'EUR'), auth.uid()
  FROM private.split_gross(v_gross, v_vat_bps) s
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$function$;

REVOKE ALL ON FUNCTION public.issue_booking_invoice(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_booking_invoice(uuid, text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
