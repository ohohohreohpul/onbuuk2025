/*
  Promotion emails are built from blocks (header, heading, text, image, button,
  offer, voucher cards, divider), stored as JSON. The older single fields stay
  readable: campaigns without blocks are converted when they are sent.
*/
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_blocks_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_blocks_check
  CHECK (jsonb_typeof(blocks) = 'array' AND jsonb_array_length(blocks) <= 30 AND pg_column_size(blocks) <= 100000);

-- body was required for the single-text design; with blocks it may be empty.
ALTER TABLE public.marketing_campaigns ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_body_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_body_check CHECK (length(body) <= 10000);
