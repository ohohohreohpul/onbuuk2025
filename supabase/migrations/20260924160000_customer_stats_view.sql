/*
  Single source of truth for customer statistics.

  customers.total_bookings / total_spent_cents / first_visit_date / last_visit_date
  are insert-only counters that never go down (deletes, cancellations and no-shows
  never adjust them), so every screen that read them drifted from reality.

  This view derives the numbers from bookings on every read. Each booking lands in
  exactly one bucket, so total_count = visits + no_shows + cancelled + upcoming:

    no_show    bookings.no_show = true
    cancelled  status = 'cancelled' (and not a no-show)
    visit      status = 'completed', or 'confirmed' with a date before today
    upcoming   everything else (pending, or confirmed today / later)

  Spend is what the booking was charged (final_amount_cents, falling back to the
  list price for older bookings), counted for visits only.

  security_invoker = true: callers only see rows their own RLS allows.
*/

CREATE INDEX IF NOT EXISTS idx_bookings_business_email_key
  ON public.bookings (business_id, lower(btrim(customer_email)));

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
LEFT JOIN classified k
  ON k.business_id = c.business_id
 AND k.email_key = lower(btrim(c.email))
GROUP BY c.id, c.business_id;

REVOKE ALL ON public.customer_stats FROM anon;
GRANT SELECT ON public.customer_stats TO authenticated;

COMMENT ON VIEW public.customer_stats IS
  'Live customer statistics derived from bookings. Use this instead of the legacy customers.total_* counters.';
COMMENT ON COLUMN public.customers.total_bookings IS
  'LEGACY insert-only counter; not reliable. Read public.customer_stats instead.';
