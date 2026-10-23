/*
  The website chat sells digital vouchers: it stores the agreed order as a
  draft and sends a payment link /?gutschein=1&kasse=<id>. The voucher page
  loads the draft (amount, buyer, recipient, message) and goes straight to
  payment. The id is random (uuid) and the draft expires after 3 days, so the
  link carries no personal data and cannot be guessed.
*/
CREATE TABLE IF NOT EXISTS public.gift_card_checkout_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('value', 'set', 'pass')),
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents > 0),
  package_id uuid REFERENCES public.gift_card_packages(id) ON DELETE CASCADE,
  pass_offer_id uuid REFERENCES public.service_pass_offers(id) ON DELETE CASCADE,
  buyer_name text NOT NULL CHECK (length(btrim(buyer_name)) BETWEEN 1 AND 120),
  buyer_email text NOT NULL CHECK (buyer_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' AND length(buyer_email) <= 200),
  recipient_email text CHECK (recipient_email IS NULL OR (recipient_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' AND length(recipient_email) <= 200)),
  message text CHECK (message IS NULL OR length(message) <= 500),
  conversation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '3 days',
  CHECK ((kind = 'value' AND amount_cents IS NOT NULL) OR (kind = 'set' AND package_id IS NOT NULL) OR (kind = 'pass' AND pass_offer_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS gift_card_checkout_drafts_business_idx ON public.gift_card_checkout_drafts (business_id, created_at DESC);
-- Only the edge functions (service role) write; the page reads one draft through the function below.
ALTER TABLE public.gift_card_checkout_drafts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_gift_card_checkout_draft(p_draft_id uuid, p_business_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'kind', d.kind, 'amountCents', d.amount_cents, 'packageId', d.package_id, 'passOfferId', d.pass_offer_id,
    'buyerName', d.buyer_name, 'buyerEmail', d.buyer_email, 'recipientEmail', d.recipient_email, 'message', d.message)
  FROM public.gift_card_checkout_drafts d
  WHERE d.id = p_draft_id AND d.business_id = p_business_id AND d.expires_at > now();
$function$;

REVOKE ALL ON FUNCTION public.get_gift_card_checkout_draft(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_gift_card_checkout_draft(uuid, uuid) TO anon, authenticated;
