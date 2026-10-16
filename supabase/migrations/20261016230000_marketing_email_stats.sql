/*
  Email campaign results (2026-10-16).

  Each sent email carries an unguessable token. The open image and the click links
  (served from the app's own domain, /api/m) record the first open and first click
  per email. Admins only ever see totals per campaign run:
  sent, opened, clicked, unsubscribed, and what recipients bought within 7 days
  (vouchers and bookings, matched by email address).
*/

ALTER TABLE public.marketing_sends
  ADD COLUMN IF NOT EXISTS track_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS marketing_sends_track_token_key ON public.marketing_sends (track_token);

-- The sender needs the token of each claimed row.
DROP FUNCTION IF EXISTS public.claim_marketing_sends(integer);
CREATE FUNCTION public.claim_marketing_sends(p_limit integer DEFAULT 40)
 RETURNS TABLE (id uuid, campaign_id uuid, business_id uuid, customer_id uuid, email text, attempts integer, track_token uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  UPDATE public.marketing_sends s
  SET status = 'sending', attempts = s.attempts + 1, locked_at = now()
  WHERE s.id IN (
    SELECT q.id FROM public.marketing_sends q
    WHERE q.status = 'queued' OR (q.status = 'sending' AND q.locked_at < now() - interval '10 minutes')
    ORDER BY q.created_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING s.id, s.campaign_id, s.business_id, s.customer_id, s.email, s.attempts, s.track_token;
$function$;
REVOKE ALL ON FUNCTION public.claim_marketing_sends(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketing_sends(integer) TO service_role;

/** Called by the app's /api/m endpoint (anon): first open / first click of one email. */
CREATE OR REPLACE FUNCTION public.record_marketing_event(p_token uuid, p_kind text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.marketing_sends
     SET opened_at = coalesce(opened_at, now()),
         clicked_at = CASE WHEN p_kind = 'click' THEN coalesce(clicked_at, now()) ELSE clicked_at END
   WHERE track_token = p_token AND status = 'sent' AND p_kind IN ('open', 'click');
$$;
REVOKE ALL ON FUNCTION public.record_marketing_event(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_marketing_event(uuid, text) TO anon, authenticated, service_role;

/** Totals per run of one campaign, for the admin of that shop. */
CREATE OR REPLACE FUNCTION public.get_marketing_campaign_stats(p_campaign_id uuid)
RETURNS TABLE (
  run_key text, first_sent_at timestamptz, sent integer, opened integer, clicked integer, unsubscribed integer,
  voucher_sales integer, voucher_cents integer, bookings integer, booking_cents integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH s AS (
    SELECT ms.* FROM public.marketing_sends ms
    WHERE ms.campaign_id = p_campaign_id AND ms.status = 'sent'
      AND ms.business_id = public.get_admin_business_id()
  )
  SELECT
    s.run_key,
    min(s.sent_at),
    count(*)::integer,
    count(s.opened_at)::integer,
    count(s.clicked_at)::integer,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.customers c WHERE c.id = s.customer_id AND c.newsletter_status = 'unsubscribed'))::integer,
    coalesce(sum(v.n), 0)::integer, coalesce(sum(v.cents), 0)::integer,
    coalesce(sum(k.n), 0)::integer, coalesce(sum(k.cents), 0)::integer
  FROM s
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, sum(x.cents) AS cents FROM (
      SELECT o.total_cents AS cents FROM public.gift_card_orders o
       WHERE o.business_id = s.business_id AND lower(o.buyer_email) = lower(s.email) AND o.status <> 'cancelled'
         AND o.created_at > s.sent_at AND o.created_at < s.sent_at + interval '7 days'
      UNION ALL
      SELECT g.original_value_cents FROM public.gift_cards g
       WHERE g.business_id = s.business_id AND g.order_id IS NULL AND lower(g.purchased_by_email) = lower(s.email)
         AND g.created_at > s.sent_at AND g.created_at < s.sent_at + interval '7 days'
    ) x
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n, sum(coalesce(b.final_amount_cents, b.total_price_cents, 0)) AS cents FROM public.bookings b
     WHERE b.business_id = s.business_id AND lower(b.customer_email) = lower(s.email) AND b.status <> 'cancelled'
       AND b.created_at > s.sent_at AND b.created_at < s.sent_at + interval '7 days'
  ) k ON true
  GROUP BY s.run_key
  ORDER BY min(s.sent_at) DESC;
$$;
REVOKE ALL ON FUNCTION public.get_marketing_campaign_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_marketing_campaign_stats(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
