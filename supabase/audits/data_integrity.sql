-- Zenno data-integrity audit (read-only).
-- Run: npm run audit:data
-- Each row is one invariant. violations = 0 means the invariant holds.
-- severity: critical = money or cross-tenant; high = UI shows wrong numbers; info = worth a look.

WITH
booking_customer AS (
  SELECT b.*, lower(btrim(b.customer_email)) AS email_key
  FROM bookings b
),
customer_actuals AS (
  SELECT c.id, c.business_id, c.name, c.email, c.total_bookings, c.total_spent_cents, c.last_visit_date,
         count(b.id) AS actual_bookings,
         count(b.id) FILTER (WHERE b.status <> 'cancelled' AND NOT b.no_show) AS actual_kept,
         coalesce(sum(d.price_cents) FILTER (WHERE b.status = 'completed'), 0) AS actual_completed_spend,
         max(b.booking_date) FILTER (WHERE b.status IN ('confirmed', 'completed') AND NOT b.no_show AND b.booking_date <= current_date) AS actual_last_visit
  FROM customers c
  LEFT JOIN booking_customer b ON b.business_id = c.business_id AND b.email_key = lower(btrim(c.email))
  LEFT JOIN service_durations d ON d.id = b.duration_id
  GROUP BY c.id
),
checks AS (
  -- ---------- Customers ----------
  SELECT 'legacy customers.total_bookings counter (UI now uses customer_stats)' AS check_name, 'info' AS severity,
         count(*) AS violations,
         jsonb_agg(jsonb_build_object('customer', name, 'stored', total_bookings, 'actual', actual_bookings)) FILTER (WHERE true) AS sample
  FROM (SELECT * FROM customer_actuals WHERE coalesce(total_bookings, 0) <> actual_bookings LIMIT 1000) x

  UNION ALL
  SELECT 'legacy customers.total_spent counter (UI now uses customer_stats)', 'info', count(*),
         jsonb_agg(jsonb_build_object('customer', name, 'stored', total_spent_cents, 'actual', actual_completed_spend))
  FROM customer_actuals WHERE coalesce(total_spent_cents, 0) <> actual_completed_spend

  UNION ALL
  SELECT 'legacy customers.last_visit counter (UI now uses customer_stats)', 'info', count(*),
         jsonb_agg(jsonb_build_object('customer', name, 'stored', last_visit_date::date, 'actual', actual_last_visit))
  FROM customer_actuals WHERE last_visit_date::date IS DISTINCT FROM actual_last_visit

  UNION ALL
  SELECT 'no duplicate customers per business (case-insensitive email)', 'high', count(*),
         jsonb_agg(jsonb_build_object('email', email_key, 'rows', n))
  FROM (SELECT business_id, lower(btrim(email)) email_key, count(*) n FROM customers GROUP BY 1, 2 HAVING count(*) > 1) x

  UNION ALL
  SELECT 'every booking has a customer record', 'high', count(*),
         jsonb_agg(jsonb_build_object('booking', b.id, 'email', b.customer_email))
  FROM booking_customer b
  WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.business_id = b.business_id AND lower(btrim(c.email)) = b.email_key)

  UNION ALL
  SELECT 'customer_stats buckets add up to total bookings', 'critical', count(*),
         jsonb_agg(jsonb_build_object('customer', customer_id))
  FROM customer_stats
  WHERE total_count <> visits_count + no_show_count + cancelled_count + upcoming_count

  -- ---------- Bookings ----------
  UNION ALL
  SELECT 'booking.status is a known value', 'high', count(*),
         jsonb_agg(DISTINCT status)
  FROM bookings WHERE status NOT IN ('pending', 'confirmed', 'completed', 'cancelled')

  UNION ALL
  SELECT 'no-show bookings are not also completed', 'high', count(*),
         jsonb_agg(jsonb_build_object('booking', id, 'status', status))
  FROM bookings WHERE no_show AND status = 'completed'

  UNION ALL
  SELECT 'booking service/duration/specialist belong to same business', 'critical', count(*),
         jsonb_agg(jsonb_build_object('booking', b.id))
  FROM bookings b
  LEFT JOIN services s ON s.id = b.service_id
  LEFT JOIN service_durations d ON d.id = b.duration_id
  LEFT JOIN specialists sp ON sp.id = b.specialist_id
  WHERE s.business_id IS DISTINCT FROM b.business_id
     OR (d.id IS NOT NULL AND d.service_id IS DISTINCT FROM b.service_id)
     OR (sp.id IS NOT NULL AND sp.business_id IS DISTINCT FROM b.business_id)

  UNION ALL
  SELECT 'no double-booked specialists (active bookings, same start)', 'high', count(*),
         jsonb_agg(jsonb_build_object('specialist', specialist_id, 'date', booking_date, 'time', start_time, 'n', n))
  FROM (SELECT specialist_id, booking_date, start_time, count(*) n FROM bookings
        WHERE specialist_id IS NOT NULL AND status <> 'cancelled' AND NOT no_show
        GROUP BY 1, 2, 3 HAVING count(*) > 1) x

  UNION ALL
  SELECT 'pending bookings are not in the past', 'info', count(*),
         jsonb_agg(jsonb_build_object('booking', id, 'date', booking_date))
  FROM bookings WHERE status = 'pending' AND booking_date < current_date

  UNION ALL
  SELECT 'past confirmed bookings were checked out (completed or no-show)', 'info', count(*),
         jsonb_agg(jsonb_build_object('booking', id, 'date', booking_date))
  FROM bookings WHERE status = 'confirmed' AND NOT no_show AND booking_date < current_date

  -- ---------- No-show fees ----------
  UNION ALL
  SELECT 'every billable no-show has a fee record', 'critical', count(*),
         jsonb_agg(jsonb_build_object('booking', b.id, 'customer', b.customer_name, 'date', b.booking_date))
  FROM bookings b JOIN services s ON s.id = b.service_id
  WHERE b.no_show AND coalesce(s.no_show_fee, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM no_show_fees f WHERE f.booking_id = b.id)

  UNION ALL
  SELECT 'fee records point to an existing no-show booking', 'critical', count(*),
         jsonb_agg(jsonb_build_object('fee', f.id, 'booking_exists', b.id IS NOT NULL, 'no_show', b.no_show))
  FROM no_show_fees f LEFT JOIN bookings b ON b.id = f.booking_id
  WHERE b.id IS NULL OR (NOT b.no_show AND f.reason = 'no_show')

  UNION ALL
  SELECT 'fee customer matches booking customer', 'high', count(*),
         jsonb_agg(jsonb_build_object('fee', f.id))
  FROM no_show_fees f JOIN bookings b ON b.id = f.booking_id LEFT JOIN customers c ON c.id = f.customer_id
  WHERE c.id IS NULL OR lower(btrim(c.email)) <> lower(btrim(b.customer_email)) OR c.business_id <> b.business_id

  UNION ALL
  SELECT 'booking.no_show_fee_charged agrees with fee record', 'critical', count(*),
         jsonb_agg(jsonb_build_object('booking', b.id, 'charged', b.no_show_fee_charged, 'fee_status', f.resolution_status))
  FROM bookings b LEFT JOIN no_show_fees f ON f.booking_id = b.id
  WHERE coalesce(b.no_show_fee_charged, 0) > 0 AND (f.id IS NULL OR f.resolution_status <> 'paid')

  UNION ALL
  SELECT 'service no-show fee fields agree (no_show_fee / _amount / _enabled)', 'high', count(*),
         jsonb_agg(jsonb_build_object('service', name, 'fee', no_show_fee, 'amount', no_show_fee_amount, 'enabled', no_show_fee_enabled))
  FROM services
  WHERE (coalesce(no_show_fee, 0) > 0) IS DISTINCT FROM coalesce(no_show_fee_enabled, false)
     OR (no_show_fee_amount IS NOT NULL AND coalesce(no_show_fee, 0) <> no_show_fee_amount)

  -- ---------- Loyalty ----------
  UNION ALL
  SELECT 'loyalty balance equals sum of transactions', 'high', count(*),
         jsonb_agg(jsonb_build_object('customer', lp.customer_id, 'balance', lp.points_balance, 'ledger', t.total))
  FROM loyalty_points lp
  LEFT JOIN (SELECT customer_id, sum(points) total FROM loyalty_transactions GROUP BY 1) t ON t.customer_id = lp.customer_id
  WHERE lp.points_balance <> coalesce(t.total, 0)

  UNION ALL
  SELECT 'loyalty points not kept for cancelled/no-show/deleted bookings', 'high', count(*),
         jsonb_agg(jsonb_build_object('txn', t.id, 'booking_exists', b.id IS NOT NULL, 'status', b.status))
  FROM loyalty_transactions t LEFT JOIN bookings b ON b.id = t.booking_id
  WHERE t.booking_id IS NOT NULL AND t.points > 0
    AND (b.id IS NULL OR b.status = 'cancelled' OR b.no_show)

  -- ---------- Gift cards ----------
  UNION ALL
  SELECT 'gift card balance within 0..original value', 'critical', count(*),
         jsonb_agg(jsonb_build_object('card', code, 'balance', current_balance_cents, 'original', original_value_cents))
  FROM gift_cards
  WHERE current_balance_cents < 0 OR current_balance_cents > original_value_cents
     OR (remaining_visits IS NOT NULL AND (remaining_visits < 0 OR remaining_visits > coalesce(original_visits, remaining_visits)))
)
SELECT check_name, severity, violations, CASE WHEN violations > 0 THEN sample END AS sample
FROM checks
ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, violations DESC;
