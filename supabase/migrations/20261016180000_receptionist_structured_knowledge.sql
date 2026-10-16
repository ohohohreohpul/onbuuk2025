-- "What it knows" is built from the app's own data (treatments, prices,
-- therapists, opening hours, vouchers, promotion, booking rules). The only
-- extras are a fixed form of address and short question/answer entries —
-- no free text that could contradict what is configured.

ALTER TABLE public.receptionist_settings
  ADD COLUMN IF NOT EXISTS address_form text NOT NULL DEFAULT 'sie' CHECK (address_form IN ('sie', 'du')),
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(faq) = 'array' AND jsonb_array_length(faq) <= 30 AND pg_column_size(faq) <= 20000);

NOTIFY pgrst, 'reload schema';
