/*
  # Add Gift Card Customization Fields

  ## Changes
  1. Add design_url to gift_card_settings
    - Stores the custom 1:1 ratio design uploaded by admin (as data URL)
    - Used on the left side of the gift card PDF
  
  2. Add terms_and_conditions to gift_card_settings
    - Configurable terms and conditions text
    - Displayed on the right side of gift card PDF
    - Default terms provided

  3. Add design_url to gift_cards
    - Stores the design that was active when this card was purchased
    - Ensures historical gift cards keep their original design

  ## Security
  - No new RLS policies needed
  - Existing admin policies cover these new fields
*/

-- Add design and terms to gift_card_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_card_settings' AND column_name = 'design_url'
  ) THEN
    ALTER TABLE gift_card_settings ADD COLUMN design_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_card_settings' AND column_name = 'terms_and_conditions'
  ) THEN
    ALTER TABLE gift_card_settings ADD COLUMN terms_and_conditions text DEFAULT 
'Gift Card Terms & Conditions:

• This gift card is valid for services at our establishment only
• Cannot be exchanged for cash
• Lost or stolen cards cannot be replaced
• Cannot be combined with other promotional offers
• Check your balance at any time using your gift card code
• Present this gift card code when booking your appointment';
  END IF;
END $$;

-- Add design_url to gift_cards table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_cards' AND column_name = 'design_url'
  ) THEN
    ALTER TABLE gift_cards ADD COLUMN design_url text;
  END IF;
END $$;
