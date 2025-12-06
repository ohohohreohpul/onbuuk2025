/*
  # Add Comprehensive Theme Customization Support

  ## Overview
  This migration enhances the theme customization system by ensuring all necessary
  color keys are supported and updating default theme colors to match the new design system.

  ## Changes
  1. Add secondary_hover color support
  2. Update default color values to match new design tokens
  3. Ensure all businesses have complete theme color sets

  ## Color Keys Supported
  - primary: Main brand color (#008374)
  - primary_hover: Hover state for primary color (#006b5e)
  - secondary: Secondary brand color (#89BA16)
  - secondary_hover: Hover state for secondary color (#72970f)
  - text_primary: Primary text color (#171717)
  - text_secondary: Secondary text color (#737373)
  - background: Main background color (#ffffff)
  - background_secondary: Secondary background color (#f5f5f5)
  - border: Border color (#e5e5e5)
  - accent: Accent color (#89BA16)

  ## Migration Strategy
  - Safely adds missing color keys without affecting existing customizations
  - Uses ON CONFLICT to prevent duplicate entries
  - Updates existing businesses that don't have all color keys
*/

-- Function to ensure a business has all required theme colors
CREATE OR REPLACE FUNCTION ensure_complete_theme_colors(business_uuid uuid)
RETURNS void AS $$
BEGIN
  -- Insert missing color keys with default values
  INSERT INTO public.booking_form_colors (business_id, color_key, color_value)
  VALUES
    (business_uuid, 'primary', '#008374'),
    (business_uuid, 'primary_hover', '#006b5e'),
    (business_uuid, 'secondary', '#89BA16'),
    (business_uuid, 'secondary_hover', '#72970f'),
    (business_uuid, 'text_primary', '#171717'),
    (business_uuid, 'text_secondary', '#737373'),
    (business_uuid, 'background', '#ffffff'),
    (business_uuid, 'background_secondary', '#f5f5f5'),
    (business_uuid, 'border', '#e5e5e5'),
    (business_uuid, 'accent', '#89BA16')
  ON CONFLICT (business_id, color_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply complete theme colors to all existing businesses
DO $$
DECLARE
  business_record RECORD;
BEGIN
  FOR business_record IN SELECT id FROM businesses
  LOOP
    PERFORM ensure_complete_theme_colors(business_record.id);
  END LOOP;
END $$;

-- Update the business initialization function to include all color keys
CREATE OR REPLACE FUNCTION initialize_business_defaults(business_uuid uuid)
RETURNS void AS $$
BEGIN
  -- Ensure complete theme colors
  PERFORM ensure_complete_theme_colors(business_uuid);
  
  -- Other initialization tasks can be added here in the future
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comment to the booking_form_colors table
COMMENT ON TABLE booking_form_colors IS 'Stores customizable theme colors for each business. Supports primary, secondary, text, background, border, and accent colors with hover states.';
COMMENT ON COLUMN booking_form_colors.color_key IS 'Theme color identifier (e.g., primary, primary_hover, secondary, text_primary)';
COMMENT ON COLUMN booking_form_colors.color_value IS 'Hex color value (e.g., #008374)';
