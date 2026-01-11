/*
  # Fix Gift Card Code Uniqueness to Per-Business
  
  The original schema had `code` as globally unique, which prevented
  different businesses from having gift cards with the same code.
  
  This migration changes it to be unique per business (business_id + code),
  which is the correct behavior for a multi-tenant system.
*/

-- Drop the global unique constraint on code
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_code_key;

-- Add composite unique constraint: code must be unique within each business
ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_business_code_unique UNIQUE (business_id, code);

-- Add an index for faster lookups by code (still useful for redemption lookups)
CREATE INDEX IF NOT EXISTS idx_gift_cards_code_lookup ON gift_cards(code);
