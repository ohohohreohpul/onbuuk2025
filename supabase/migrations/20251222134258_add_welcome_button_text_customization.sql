/*
  # Add Welcome Step Button Text Customization

  1. Changes
    - Add `bookingButtonText` and `giftCardButtonText` to welcome_step JSONB field
    - Allows customization of "Book an Appointment" and "Purchase a Gift Card" buttons
    - Maintains backward compatibility with existing records

  2. Migration
    - Updates welcome_step JSONB structure to include new button text fields
    - Old records without these fields will use defaults from the application
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_form_customization') THEN
    -- Update existing records to include new button text fields if they don't have them
    UPDATE booking_form_customization
    SET welcome_step = COALESCE(welcome_step, '{}'::jsonb)
      || jsonb_build_object(
        'bookingButtonText', 'Book an Appointment',
        'giftCardButtonText', 'Purchase a Gift Card'
      )
    WHERE (welcome_step->>'bookingButtonText' IS NULL OR welcome_step->>'giftCardButtonText' IS NULL);
  END IF;
END $$;