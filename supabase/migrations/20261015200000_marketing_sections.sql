/*
  Promotion emails get sections: header (headline, image), the existing text,
  "Angebot des Monats", the shop's voucher cards (filled in automatically when
  sending), and a closing text. All new fields are optional.
*/
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS headline text CHECK (headline IS NULL OR length(headline) <= 120),
  ADD COLUMN IF NOT EXISTS hero_image_url text CHECK (hero_image_url IS NULL OR hero_image_url ~* '^https://'),
  ADD COLUMN IF NOT EXISTS offer_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_title text CHECK (offer_title IS NULL OR length(offer_title) <= 120),
  ADD COLUMN IF NOT EXISTS offer_text text CHECK (offer_text IS NULL OR length(offer_text) <= 2000),
  ADD COLUMN IF NOT EXISTS offer_image_url text CHECK (offer_image_url IS NULL OR offer_image_url ~* '^https://'),
  ADD COLUMN IF NOT EXISTS offer_price_cents integer CHECK (offer_price_cents IS NULL OR offer_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS offer_compare_cents integer CHECK (offer_compare_cents IS NULL OR offer_compare_cents >= 0),
  ADD COLUMN IF NOT EXISTS offer_button_text text CHECK (offer_button_text IS NULL OR length(offer_button_text) <= 60),
  ADD COLUMN IF NOT EXISTS offer_button_url text CHECK (offer_button_url IS NULL OR offer_button_url ~* '^https://'),
  ADD COLUMN IF NOT EXISTS vouchers_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vouchers_title text CHECK (vouchers_title IS NULL OR length(vouchers_title) <= 120),
  ADD COLUMN IF NOT EXISTS closing text CHECK (closing IS NULL OR length(closing) <= 2000);

-- Short line under the hero button ("3 Jahre gültig · online kaufen · sofort per E-Mail").
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS hero_caption text CHECK (hero_caption IS NULL OR length(hero_caption) <= 120);
