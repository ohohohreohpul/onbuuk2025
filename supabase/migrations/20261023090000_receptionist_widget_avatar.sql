-- Picture in the website chat header (e.g. a team member). NULL = shop logo.
ALTER TABLE public.receptionist_settings
  ADD COLUMN IF NOT EXISTS widget_avatar_url text
  CHECK (widget_avatar_url IS NULL OR (widget_avatar_url ~ '^https://' AND length(widget_avatar_url) <= 1000));
