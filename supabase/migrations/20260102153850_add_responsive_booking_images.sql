/*
  # Add Responsive Image Support for Booking Layouts

  1. Changes to `booking_form_customization` table
    - Add mobile image columns for each step (e.g., `welcome_image_mobile`, `service_image_mobile`)
    - Add tablet image columns for each step (e.g., `welcome_image_tablet`, `service_image_tablet`)
    - Add desktop image columns for each step (e.g., `welcome_image_desktop`, `service_image_desktop`)
    - Existing `*_image_url` columns remain as fallback for backwards compatibility
  
  2. Image Breakpoints
    - Mobile: < 640px (sm breakpoint in Tailwind)
    - Tablet: 640px - 1024px (sm to lg breakpoints)
    - Desktop: > 1024px (lg+ breakpoints)
  
  3. Migration Notes
    - Total of 24 new columns (3 responsive variants × 8 steps)
    - Existing images continue to work as fallback
    - Businesses can optionally upload device-specific images
    - Improves performance and visual quality across all devices
*/

-- Add mobile image columns for each booking step
ALTER TABLE booking_form_customization 
ADD COLUMN IF NOT EXISTS welcome_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS service_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS duration_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS specialist_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS datetime_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS details_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS addons_image_mobile TEXT,
ADD COLUMN IF NOT EXISTS payment_image_mobile TEXT;

-- Add tablet image columns for each booking step
ALTER TABLE booking_form_customization 
ADD COLUMN IF NOT EXISTS welcome_image_tablet TEXT,
ADD COLUMN IF NOT EXISTS service_image_tablet TEXT,
ADD COLUMN IF NOT EXISTS duration_image_tablet TEXT,
ADD COLUMN IF NOT EXISTS specialist_image_tablet TEXT,
ADD COLUMN IF NOT EXISTS datetime_image_tablet TEXT,
ADD COLUMN IF NOT EXISTS details_image_tablet TEXT,
ADD COLUMN IF NOT EXISTS addons_image_tablet TEXT,
ADD COLUMN IF NOT EXISTS payment_image_tablet TEXT;

-- Add desktop image columns for each booking step
ALTER TABLE booking_form_customization 
ADD COLUMN IF NOT EXISTS welcome_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS service_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS duration_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS specialist_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS datetime_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS details_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS addons_image_desktop TEXT,
ADD COLUMN IF NOT EXISTS payment_image_desktop TEXT;

-- Add helpful comments explaining the responsive image system
COMMENT ON COLUMN booking_form_customization.welcome_image_mobile IS 'Mobile-optimized welcome image (< 640px)';
COMMENT ON COLUMN booking_form_customization.welcome_image_tablet IS 'Tablet-optimized welcome image (640px - 1024px)';
COMMENT ON COLUMN booking_form_customization.welcome_image_desktop IS 'Desktop-optimized welcome image (> 1024px)';
COMMENT ON COLUMN booking_form_customization.welcome_image_url IS 'Fallback welcome image when responsive images not set';