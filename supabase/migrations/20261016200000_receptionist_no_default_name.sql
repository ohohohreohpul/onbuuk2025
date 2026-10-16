-- The receptionist speaks for the shop, not for Zenno: no default personal name.
-- An empty name means "introduce yourself as the shop" (e.g. "Hi, this is SATUUU99").
ALTER TABLE public.receptionist_settings DROP CONSTRAINT IF EXISTS receptionist_settings_assistant_name_check;
ALTER TABLE public.receptionist_settings
  ADD CONSTRAINT receptionist_settings_assistant_name_check CHECK (char_length(assistant_name) <= 40),
  ALTER COLUMN assistant_name SET DEFAULT '';
UPDATE public.receptionist_settings SET assistant_name = '' WHERE assistant_name = 'Zenno';
NOTIFY pgrst, 'reload schema';
