/*
  # Add Quantity Limits to Products

  ## Overview
  Add constraints to products to limit how many can be added per booking.
  This is useful for service extras like "Add Hot Stones" (max 1) vs 
  "Add Aromatherapy Oil" (max 3).

  ## Changes to Existing Tables
  
  ### products
  - Add max_quantity_per_booking (integer, nullable) - maximum number allowed per booking
    - NULL means unlimited
    - Default 1 for new products
  
  ## Purpose
  Business owners can now control how many times an add-on can be added:
  - Single-use extras: max_quantity_per_booking = 1
  - Multiple-use products: max_quantity_per_booking = 5 (or any number)
  - Unlimited: max_quantity_per_booking = NULL
*/

-- Add max_quantity_per_booking column to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS max_quantity_per_booking integer CHECK (max_quantity_per_booking IS NULL OR max_quantity_per_booking > 0);

-- Set default to 1 for existing products (assuming most are single-use extras)
UPDATE products
SET max_quantity_per_booking = 1
WHERE max_quantity_per_booking IS NULL;
