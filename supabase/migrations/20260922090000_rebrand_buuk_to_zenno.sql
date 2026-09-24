/*
  Rebrand the customer-facing booking product from Buuk to Zenno.

  This migration deliberately leaves table names, IDs, and the currently
  verified transactional email domain unchanged. Those are infrastructure
  concerns and can move independently without risking booking or email
  delivery. Merchant-created custom branding is preserved.
*/

ALTER TABLE businesses
  ALTER COLUMN custom_logo_url SET DEFAULT '/zenno-logo.svg';

UPDATE businesses
SET custom_logo_url = '/zenno-logo.svg'
WHERE custom_logo_url IS NULL
   OR custom_logo_url = ''
   OR custom_logo_url IN (
     '/defbuuklogo.png',
     '/blbuuklogo.png',
     '/buuklogo copy.png',
     '/buuklogo copy copy.png',
     '/buuklogo copy copy copy.png'
   );

UPDATE businesses
SET custom_page_title = replace(custom_page_title, 'Buuk', 'Zenno')
WHERE custom_page_title LIKE '%Buuk%';

UPDATE businesses
SET custom_meta_description = replace(
  replace(custom_meta_description, 'Buuk', 'Zenno'),
  'buuk',
  'Zenno'
)
WHERE custom_meta_description ILIKE '%buuk%';

COMMENT ON COLUMN businesses.custom_logo_url IS
  'Custom brand logo URL. Default: /zenno-logo.svg. Pro users can upload custom logos.';
COMMENT ON COLUMN businesses.hide_powered_by_badge IS
  'Hide the Powered by Zenno badge on booking pages (Pro only).';

-- Only migrate untouched former platform defaults; preserve merchant colors.
UPDATE booking_form_colors
SET color_value = CASE color_value
  WHEN '#008374' THEN '#1A1714'
  WHEN '#006b5e' THEN '#2E2926'
  WHEN '#006d5f' THEN '#2E2926'
  WHEN '#00a894' THEN '#3D3833'
  WHEN '#89BA16' THEN '#A09990'
  WHEN '#72970f' THEN '#6B6560'
  WHEN '#171717' THEN '#1A1714'
  WHEN '#737373' THEN '#6B6560'
  WHEN '#f5f5f5' THEN '#F9F7F4'
  WHEN '#e5e5e5' THEN '#EEEBE6'
  ELSE color_value
END
WHERE color_value IN (
  '#008374', '#006b5e', '#006d5f', '#00a894', '#89BA16',
  '#72970f', '#171717', '#737373', '#f5f5f5', '#e5e5e5'
);

ALTER TABLE platform_email_templates
  ALTER COLUMN from_name SET DEFAULT 'Zenno';
ALTER TABLE platform_email_settings
  ALTER COLUMN default_from_name SET DEFAULT 'Zenno';

UPDATE platform_email_settings
SET default_from_name = 'Zenno',
    updated_at = now()
WHERE default_from_name ILIKE '%buuk%';

UPDATE platform_email_templates
SET template_name = replace(template_name, 'Buuk', 'Zenno'),
    subject = replace(replace(subject, 'Buuk', 'Zenno'), 'buuk', 'Zenno'),
    html_body = replace(
      replace(
        replace(
          replace(
            replace(html_body, 'app.buuk.com', 'app.zenno.ai'),
            'book.buuk.com',
            'app.zenno.ai'
          ),
          'help.buuk.com',
          'zenno.ai/docs'
        ),
        'Buuk',
        'Zenno'
      ),
      'buuk',
      'Zenno'
    ),
    text_body = replace(
      replace(
        replace(
          replace(
            replace(coalesce(text_body, ''), 'app.buuk.com', 'app.zenno.ai'),
            'book.buuk.com',
            'app.zenno.ai'
          ),
          'help.buuk.com',
          'zenno.ai/docs'
        ),
        'Buuk',
        'Zenno'
      ),
      'buuk',
      'Zenno'
    ),
    from_name = 'Zenno',
    preview_data = replace(
      replace(
        replace(preview_data::text, 'app.buuk.com', 'app.zenno.ai'),
        'book.buuk.com',
        'app.zenno.ai'
      ),
      'help.buuk.com',
      'zenno.ai/docs'
    )::jsonb,
    updated_at = now()
WHERE template_name ILIKE '%buuk%'
   OR subject ILIKE '%buuk%'
   OR html_body ILIKE '%buuk%'
   OR coalesce(text_body, '') ILIKE '%buuk%'
   OR from_name ILIKE '%buuk%'
   OR preview_data::text ILIKE '%buuk%';
