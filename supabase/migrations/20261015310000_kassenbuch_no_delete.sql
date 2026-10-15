/*
  GoBD: Kassenbuch lines are never edited or deleted by the shop.
  A wrong entry is cancelled with a "Storno" line (same amounts, negative),
  linked to the original so it can only be cancelled once.
*/
ALTER TABLE public.cash_entries
  ADD COLUMN IF NOT EXISTS reverses_entry_id uuid REFERENCES public.cash_entries(id);

CREATE UNIQUE INDEX IF NOT EXISTS cash_entries_reversed_once
  ON public.cash_entries (reverses_entry_id) WHERE reverses_entry_id IS NOT NULL;

-- Admins may read and add, nothing else.
DROP POLICY IF EXISTS "Admins can manage own business cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "Admins can add own business cash_entries" ON public.cash_entries;
CREATE POLICY "Admins can add own business cash_entries"
  ON public.cash_entries FOR INSERT TO authenticated
  WITH CHECK (business_id = public.get_admin_business_id());

CREATE OR REPLACE FUNCTION public.reverse_cash_entry(p_entry_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v public.cash_entries;
  v_new uuid;
BEGIN
  SELECT * INTO v FROM public.cash_entries
   WHERE id = p_entry_id AND business_id = public.get_admin_business_id()
   FOR UPDATE;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Entry not found' USING ERRCODE = '42501';
  END IF;
  IF v.is_reversal OR v.reverses_entry_id IS NOT NULL THEN
    RAISE EXCEPTION 'A Storno line cannot be cancelled again' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cash_entries WHERE reverses_entry_id = v.id) THEN
    RAISE EXCEPTION 'This entry is already cancelled' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.cash_entries (
    business_id, entry_date, entry_time, description, source, booking_id, payment_method,
    gross_cents, net_cents, vat_rate_bps, is_reversal, reverses_entry_id, created_by
  ) VALUES (
    v.business_id,
    (now() AT TIME ZONE 'Europe/Berlin')::date,
    (now() AT TIME ZONE 'Europe/Berlin')::time,
    'Storno: ' || v.description,
    v.source, v.booking_id, v.payment_method,
    -v.gross_cents, -v.net_cents, v.vat_rate_bps, true, v.id, auth.uid()
  )
  RETURNING id INTO v_new;
  RETURN v_new;
END;
$function$;

REVOKE ALL ON FUNCTION public.reverse_cash_entry(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reverse_cash_entry(uuid) TO authenticated;
