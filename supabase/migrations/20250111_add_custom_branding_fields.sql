/*
  # Add Custom Branding Fields for Businesses
  
  Adds fields for premium users to customize:
  - Website title (browser tab)
  - Favicon
  - Open Graph image (social media previews)
  - Meta description
  
  These features are gated behind the premium plan (same as hide_powered_by_badge)
*/

-- Add custom branding columns to businesses table
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS custom_page_title text,
ADD COLUMN IF NOT EXISTS custom_favicon_url text,
ADD COLUMN IF NOT EXISTS custom_og_image_url text,
ADD COLUMN IF NOT EXISTS custom_meta_description text;

-- Add comment for documentation
COMMENT ON COLUMN businesses.custom_page_title IS 'Custom page title shown in browser tab (premium feature)';
COMMENT ON COLUMN businesses.custom_favicon_url IS 'Custom favicon URL (premium feature)';
COMMENT ON COLUMN businesses.custom_og_image_url IS 'Custom Open Graph image for social media previews (premium feature)';
COMMENT ON COLUMN businesses.custom_meta_description IS 'Custom meta description for SEO and social previews (premium feature)';
