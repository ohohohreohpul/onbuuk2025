/*
  # Add category column to products table

  ## Changes
  - Add category column to products table (nullable text)
  - Add index for category column for better query performance
*/

-- Add category column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category text;

-- Create index for category column
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Add max_quantity_per_booking if it doesn't exist (from migration 20251130133342)
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_quantity_per_booking integer;
