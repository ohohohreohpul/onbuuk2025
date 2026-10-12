/*
  Thai for customer-facing pages and booking emails (Jev order 2026-10-12, item 7).
  businesses.language: 'en' | 'de' | 'th'; shops choose it in Settings > Store Profile.
*/
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_language_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_language_check CHECK (language IN ('en', 'de', 'th'));
