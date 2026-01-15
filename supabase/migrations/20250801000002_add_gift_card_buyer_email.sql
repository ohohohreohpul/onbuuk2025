-- Add purchased_by_email field to gift_cards table
-- This allows tracking the buyer's email even when they're not a registered customer

ALTER TABLE gift_cards 
ADD COLUMN IF NOT EXISTS purchased_by_email TEXT;

-- Add purchased_by_name for the buyer's name
ALTER TABLE gift_cards 
ADD COLUMN IF NOT EXISTS purchased_by_name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchased_by_email ON gift_cards(purchased_by_email) WHERE purchased_by_email IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN gift_cards.purchased_by_email IS 'Email address of the person who purchased the gift card';
COMMENT ON COLUMN gift_cards.purchased_by_name IS 'Name of the person who purchased the gift card';
