-- "How it talks": the shop's conversation protocol for fixed situations
-- (first message, booking order, prices, nothing free, after booking,
-- vouchers, handing over, goodbye). Shape: { "<situation>": { "enabled": bool, "example": text } }.
-- Situations are a fixed list (validated in receptionist-admin); facts still come from the app's data.

ALTER TABLE public.receptionist_settings
  ADD COLUMN IF NOT EXISTS playbook jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(playbook) = 'object' AND pg_column_size(playbook) <= 12000);

NOTIFY pgrst, 'reload schema';
