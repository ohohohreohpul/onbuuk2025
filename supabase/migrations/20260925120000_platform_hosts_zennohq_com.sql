/*
  zennohq.com is the primary platform domain:
    book.zennohq.com       -> app host (admin, login, sign-up)
    <permalink>.zennohq.com -> shops
  zennohq.studio keeps working as a secondary domain.
*/
UPDATE public.platform_hosts SET is_primary = false
WHERE host IN ('book.zennohq.studio', 'zennohq.studio');

INSERT INTO public.platform_hosts (host, purpose, is_primary) VALUES
  ('book.zennohq.com', 'app', true),
  ('zennohq.com', 'shop_base', true)
ON CONFLICT (host) DO UPDATE SET is_primary = EXCLUDED.is_primary;
