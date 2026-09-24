/*
  Keep the legacy frontend working against the new fee resolution model.

  The live (pre-rebrand) app marks fees with only `paid` / `paid_at`:
    update no_show_fees set paid = true,  paid_at = now()  -- "Mark Paid"
    update no_show_fees set paid = false, paid_at = null   -- "Mark Unpaid"
  Since 20260924095034 a CHECK requires resolution_status to agree with `paid`,
  so those updates were rejected (and the old UI hid the error).

  This trigger derives resolution_status from `paid` whenever a writer changes
  `paid` without touching resolution_status. Writers that set resolution_status
  explicitly (the new app) are left alone. Existing rows are not modified.
*/

CREATE OR REPLACE FUNCTION private.sync_no_show_fee_legacy_paid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_paid_changed boolean := TG_OP = 'INSERT' OR NEW.paid IS DISTINCT FROM OLD.paid;
  v_status_untouched boolean := TG_OP = 'INSERT' OR NEW.resolution_status IS NOT DISTINCT FROM OLD.resolution_status;
BEGIN
  IF NOT (v_paid_changed AND v_status_untouched) THEN
    RETURN NEW;
  END IF;

  IF NEW.paid IS TRUE AND NEW.resolution_status <> 'paid' THEN
    NEW.resolution_status := 'paid';
    NEW.paid_at := COALESCE(NEW.paid_at, now());
    NEW.resolved_at := COALESCE(NEW.resolved_at, NEW.paid_at);
  ELSIF NEW.paid IS NOT TRUE AND TG_OP = 'UPDATE' AND OLD.resolution_status = 'paid' THEN
    NEW.paid := false;
    NEW.resolution_status := 'unpaid';
    NEW.paid_at := NULL;
    NEW.resolved_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_no_show_fee_legacy_paid() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_no_show_fee_legacy_paid ON public.no_show_fees;
CREATE TRIGGER sync_no_show_fee_legacy_paid
  BEFORE INSERT OR UPDATE ON public.no_show_fees
  FOR EACH ROW EXECUTE FUNCTION private.sync_no_show_fee_legacy_paid();
