/*
  # Fix Services Category Default Value

  1. Updates
    - Remove default empty string from category field to allow proper NULL handling
    - Update existing empty categories to NULL for cleaner data

  2. Notes
    - Empty strings were being stored instead of proper category values
    - This ensures new services require a category to be set
*/

ALTER TABLE services ALTER COLUMN category DROP DEFAULT;

UPDATE services SET category = NULL WHERE category = '';