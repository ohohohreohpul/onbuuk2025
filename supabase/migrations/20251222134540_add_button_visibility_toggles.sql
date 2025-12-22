/*
  # Add Button Visibility Toggles to Welcome Step

  1. Changes
    - Add `showBookingButton` and `showGiftCardButton` flags to welcome_step JSONB field
    - Allows businesses to hide either button if not applicable
    - Both default to true (shown)

  2. Migration
    - Updates welcome_step JSONB to include visibility toggles
    - Maintains backward compatibility
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_form_customization') THEN
    UPDATE booking_form_customization
    SET welcome_step = COALESCE(welcome_step, '{}'::jsonb)
      || jsonb_build_object(
        'showBookingButton', true,
        'showGiftCardButton', true
      )
    WHERE (welcome_step->>'showBookingButton' IS NULL OR welcome_step->>'showGiftCardButton' IS NULL);
  END IF;
END $$;