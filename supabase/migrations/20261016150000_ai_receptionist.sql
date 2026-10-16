-- AI receptionist v1 (2026-10-16, Jev: docs/DECISIONS.md)
-- One agent core for three channels: website chat, email (shop mailbox via
-- IMAP), WhatsApp (official Cloud API or "own number" QR gateway), plus
-- outreach to customers with a stored consent record.
--
-- Security model: admins READ their shop's rows (RLS); every write goes through
-- the receptionist edge functions (service role), which validate input.
-- Channel secrets live in the private schema, never readable through the API.

-- ---------------------------------------------------------------------------
-- Settings (one row per shop)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receptionist_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  assistant_name text NOT NULL DEFAULT 'Zenno' CHECK (char_length(assistant_name) BETWEEN 1 AND 40),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 4000),
  knowledge text NOT NULL DEFAULT '' CHECK (char_length(knowledge) <= 12000),

  web_enabled boolean NOT NULL DEFAULT true,
  web_mode text NOT NULL DEFAULT 'auto' CHECK (web_mode IN ('auto', 'drafts')),
  widget_key text NOT NULL UNIQUE DEFAULT ('wc_' || replace(gen_random_uuid()::text, '-', '')),
  widget_greeting text NOT NULL DEFAULT '' CHECK (char_length(widget_greeting) <= 300),
  widget_color text CHECK (widget_color IS NULL OR widget_color ~ '^#[0-9A-Fa-f]{6}$'),

  email_enabled boolean NOT NULL DEFAULT false,
  email_mode text NOT NULL DEFAULT 'drafts' CHECK (email_mode IN ('auto', 'drafts')),
  imap_host text CHECK (imap_host IS NULL OR imap_host ~ '^[A-Za-z0-9.-]{3,253}$'),
  imap_port integer NOT NULL DEFAULT 993 CHECK (imap_port BETWEEN 1 AND 65535),
  imap_username text CHECK (imap_username IS NULL OR char_length(imap_username) <= 254),
  imap_uidvalidity bigint,
  imap_last_uid bigint NOT NULL DEFAULT 0,
  imap_checked_at timestamptz,
  imap_error text,

  whatsapp_enabled boolean NOT NULL DEFAULT false,
  whatsapp_mode text NOT NULL DEFAULT 'auto' CHECK (whatsapp_mode IN ('auto', 'drafts')),
  whatsapp_provider text CHECK (whatsapp_provider IN ('cloud_api', 'qr_gateway')),
  whatsapp_status text NOT NULL DEFAULT 'disconnected' CHECK (whatsapp_status IN ('disconnected', 'pending_qr', 'connected', 'error')),
  whatsapp_phone_number_id text,          -- Cloud API: Meta phone number id (routes inbound webhooks)
  whatsapp_display_phone text,
  whatsapp_instance text UNIQUE,          -- QR gateway: Evolution instance name (routes inbound webhooks)
  whatsapp_qr text,                       -- QR gateway: current pairing QR (data URL), cleared once connected
  whatsapp_warmup_started_at timestamptz,
  whatsapp_bulk_date date,
  whatsapp_bulk_sent integer NOT NULL DEFAULT 0,
  whatsapp_last_bulk_at timestamptz,

  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS receptionist_settings_wa_phone_idx
  ON public.receptionist_settings (whatsapp_phone_number_id) WHERE whatsapp_phone_number_id IS NOT NULL;

-- Secrets: WhatsApp Cloud API token, IMAP password override. Never exposed.
CREATE TABLE IF NOT EXISTS private.receptionist_secrets (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('whatsapp_cloud_token', 'whatsapp_app_secret', 'imap_password')),
  value text NOT NULL CHECK (char_length(value) BETWEEN 1 AND 4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, kind)
);
REVOKE ALL ON private.receptionist_secrets FROM PUBLIC, anon, authenticated;

-- The private schema is not exposed through the API: edge functions (service
-- role) read and write secrets through these two functions only.
CREATE OR REPLACE FUNCTION public.receptionist_set_secret(p_business_id uuid, p_kind text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    DELETE FROM private.receptionist_secrets WHERE business_id = p_business_id AND kind = p_kind;
  ELSE
    INSERT INTO private.receptionist_secrets (business_id, kind, value, updated_at)
    VALUES (p_business_id, p_kind, p_value, now())
    ON CONFLICT (business_id, kind) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.receptionist_get_secret(p_business_id uuid, p_kind text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT value FROM private.receptionist_secrets WHERE business_id = p_business_id AND kind = p_kind;
$$;

REVOKE ALL ON FUNCTION public.receptionist_set_secret(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.receptionist_get_secret(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receptionist_set_secret(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.receptionist_get_secret(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receptionist_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('web', 'email', 'whatsapp')),
  external_id text NOT NULL CHECK (char_length(external_id) BETWEEN 1 AND 320), -- visitor id | email address | phone digits
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_name text CHECK (contact_name IS NULL OR char_length(contact_name) <= 120),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  contact_phone text CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 40),
  subject text CHECK (subject IS NULL OR char_length(subject) <= 300),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'needs_human', 'closed')),
  needs_human_reason text CHECK (needs_human_reason IS NULL OR char_length(needs_human_reason) <= 500),
  is_ai_paused boolean NOT NULL DEFAULT false,
  memory text NOT NULL DEFAULT '' CHECK (char_length(memory) <= 2000),
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, channel, external_id)
);
CREATE INDEX IF NOT EXISTS receptionist_conversations_inbox_idx
  ON public.receptionist_conversations (business_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.receptionist_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.receptionist_conversations(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  author text NOT NULL CHECK (author IN ('customer', 'ai', 'staff', 'system')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'draft', 'failed', 'discarded')),
  external_id text CHECK (external_id IS NULL OR char_length(external_id) <= 500), -- provider id / email Message-ID (dedupe)
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receptionist_messages_conversation_idx
  ON public.receptionist_messages (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS receptionist_messages_external_idx
  ON public.receptionist_messages (business_id, external_id) WHERE external_id IS NOT NULL;

-- Token metering per shop (AI credits are resold later).
CREATE TABLE IF NOT EXISTS public.receptionist_usage (
  id bigserial PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.receptionist_conversations(id) ON DELETE SET NULL,
  purpose text NOT NULL CHECK (purpose IN ('reply', 'outreach', 'test')),
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receptionist_usage_business_idx ON public.receptionist_usage (business_id, created_at);

-- ---------------------------------------------------------------------------
-- Consent + outreach
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_contact_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  status text NOT NULL CHECK (status IN ('granted', 'revoked')),
  source text NOT NULL CHECK (source IN ('import', 'staff', 'chat', 'form', 'opt_out')),
  evidence text CHECK (evidence IS NULL OR char_length(evidence) <= 1000), -- what the customer agreed to / how
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  UNIQUE (business_id, customer_id, channel)
);

CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1500),
  is_personalised boolean NOT NULL DEFAULT false,
  template_name text CHECK (template_name IS NULL OR template_name ~ '^[a-z0-9_]{1,512}$'), -- Cloud API approved template
  template_language text CHECK (template_language IS NULL OR template_language ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'paused', 'done')),
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.outreach_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address text NOT NULL CHECK (char_length(address) BETWEEN 6 AND 20), -- phone digits
  name text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped')),
  error text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (campaign_id, customer_id)
);
CREATE INDEX IF NOT EXISTS outreach_recipients_due_idx
  ON public.outreach_recipients (next_attempt_at) WHERE status IN ('queued', 'sending');

-- Claim due recipients (crash-safe: 'sending' older than 5 min is retried).
CREATE OR REPLACE FUNCTION public.claim_outreach_recipients(p_limit integer DEFAULT 5)
RETURNS SETOF public.outreach_recipients
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.outreach_recipients r
  SET status = 'sending', attempt_count = r.attempt_count + 1, next_attempt_at = now() + interval '5 minutes'
  WHERE r.id IN (
    SELECT q.id FROM public.outreach_recipients q
    JOIN public.outreach_campaigns c ON c.id = q.campaign_id AND c.status = 'sending'
    WHERE q.status IN ('queued', 'sending') AND q.next_attempt_at <= now()
    ORDER BY q.next_attempt_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20)
    FOR UPDATE OF q SKIP LOCKED
  )
  RETURNING r.*;
$$;
REVOKE ALL ON FUNCTION public.claim_outreach_recipients(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outreach_recipients(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: admins read their own shop; no direct writes from the browser.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['receptionist_settings', 'receptionist_conversations', 'receptionist_messages',
                           'receptionist_usage', 'customer_contact_consents', 'outreach_campaigns', 'outreach_recipients']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins read their shop" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins read their shop" ON public.%I FOR SELECT TO authenticated USING (business_id = public.get_admin_business_id())', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Cron: poll mailboxes every minute, send outreach every 2 minutes
-- (same vault secrets as the notification outbox).
-- ---------------------------------------------------------------------------
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('receptionist-email', 'receptionist-outreach');

SELECT cron.schedule(
  'receptionist-email',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'project_url') || '/functions/v1/receptionist-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'outbox_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (SELECT 1 FROM public.receptionist_settings WHERE is_enabled AND email_enabled AND imap_host IS NOT NULL);
  $job$
);

SELECT cron.schedule(
  'receptionist-outreach',
  '*/2 * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'project_url') || '/functions/v1/receptionist-outreach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT s.decrypted_secret FROM vault.decrypted_secrets s WHERE s.name = 'outbox_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (
    SELECT 1 FROM public.outreach_recipients r
    JOIN public.outreach_campaigns c ON c.id = r.campaign_id
    WHERE c.status = 'sending' AND r.status IN ('queued', 'sending') AND r.next_attempt_at <= now()
  );
  $job$
);

NOTIFY pgrst, 'reload schema';
