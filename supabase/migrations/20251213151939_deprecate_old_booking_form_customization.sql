/*
  # Deprecate Old Booking Form Customization Tables

  ## Summary
  This migration marks the following tables as deprecated:
  - `booking_form_images`
  - `booking_form_texts`
  - `booking_form_colors`

  ## Reason
  These tables were part of an old customization system that:
  1. Did not properly integrate with the multi-tenancy system (missing business_id on saves)
  2. Had broken RLS policies that prevented data from loading correctly
  3. Duplicated functionality now available in the Settings > Booking Form tab

  ## New System
  All booking form customization is now handled through:
  - `businesses` table (booking_form_layout, show_welcome_features, use_custom_welcome_html, welcome_custom_html)
  - `welcome_feature_cards` table (for customizable feature cards on welcome page)
  - Theme customization in Settings

  ## Action
  These tables are left in the database for backwards compatibility and potential data recovery,
  but are no longer used by the application. They can be dropped in a future migration if needed.

  ## No Schema Changes
  This is a documentation-only migration. No schema changes are made.
*/

-- Add comments to document deprecation
COMMENT ON TABLE booking_form_images IS 'DEPRECATED: Use businesses.welcome_custom_html or welcome_feature_cards instead';
COMMENT ON TABLE booking_form_texts IS 'DEPRECATED: Use businesses table columns or welcome_feature_cards for customization';
COMMENT ON TABLE booking_form_colors IS 'DEPRECATED: Use theme customization in Settings instead';
