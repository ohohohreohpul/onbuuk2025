/*
  # Add Login Page Logo Column to Businesses

  1. Changes
    - Add `login_page_logo_url` column to `businesses` table
    - This allows businesses to customize the logo shown on their admin login page
    - Separate from the main logo used in the admin panel sidebar
  
  2. Notes
    - No default value set - will use system default (black Buuk logo) if null
    - Text type to support both relative paths and full URLs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'login_page_logo_url'
  ) THEN
    ALTER TABLE businesses ADD COLUMN login_page_logo_url text;
  END IF;
END $$;
