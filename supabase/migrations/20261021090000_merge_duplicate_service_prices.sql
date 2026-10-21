/*
  Saving a service used to delete + re-insert its prices. When a price was used
  by bookings or vouchers the delete failed silently and the insert still ran,
  so every save added another row (e.g. Aqua-Facial 60 min: 80 € + 3× 85 €).
  The editor now updates prices in place; this cleans up the duplicates.

  1. Freeze the price on bookings that never stored it, so changing a price
     later never rewrites what an old booking cost.
  2. Merge each (service, length) group into its oldest row with the newest price,
     moving every reference onto the kept row.
*/

-- 1. Bookings remember their price.
UPDATE public.bookings b
   SET final_amount_cents = d.price_cents
  FROM public.service_durations d
 WHERE b.duration_id = d.id AND b.final_amount_cents IS NULL;

CREATE OR REPLACE FUNCTION private.booking_default_price()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NEW.final_amount_cents IS NULL AND NEW.duration_id IS NOT NULL THEN
    SELECT price_cents INTO NEW.final_amount_cents FROM public.service_durations WHERE id = NEW.duration_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS booking_default_price ON public.bookings;
CREATE TRIGGER booking_default_price
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.booking_default_price();

-- 2. Merge duplicates.
CREATE TEMP TABLE duration_merge AS
WITH ranked AS (
  SELECT id, service_id, duration_minutes, price_cents,
         first_value(id) OVER w_old AS keep_id,
         first_value(price_cents) OVER w_new AS newest_price,
         count(*) OVER (PARTITION BY service_id, duration_minutes) AS n
    FROM public.service_durations
  WINDOW w_old AS (PARTITION BY service_id, duration_minutes ORDER BY created_at, id),
         w_new AS (PARTITION BY service_id, duration_minutes ORDER BY created_at DESC, id DESC)
)
SELECT id AS drop_id, keep_id, newest_price FROM ranked WHERE n > 1 AND id <> keep_id;

UPDATE public.bookings t SET duration_id = m.keep_id FROM duration_merge m WHERE t.duration_id = m.drop_id;
UPDATE public.booking_items t SET duration_id = m.keep_id FROM duration_merge m WHERE t.duration_id = m.drop_id;
UPDATE public.gift_cards t SET duration_id = m.keep_id FROM duration_merge m WHERE t.duration_id = m.drop_id;
UPDATE public.service_pass_offers t SET duration_id = m.keep_id FROM duration_merge m WHERE t.duration_id = m.drop_id;
UPDATE public.gift_card_package_items t SET duration_id = m.keep_id FROM duration_merge m WHERE t.duration_id = m.drop_id;
DELETE FROM public.slot_holds t USING duration_merge m WHERE t.duration_id = m.drop_id;

UPDATE public.service_durations d
   SET price_cents = m.newest_price, updated_at = now()
  FROM (SELECT DISTINCT keep_id, newest_price FROM duration_merge) m
 WHERE d.id = m.keep_id AND d.price_cents <> m.newest_price;

DELETE FROM public.service_durations d USING duration_merge m WHERE d.id = m.drop_id;

DROP TABLE duration_merge;
