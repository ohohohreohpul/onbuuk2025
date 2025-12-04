/*
  # Add Category Field to Services

  1. Updates to Existing Tables
    - Add `category` column to services table to group related services
    - Add `display_order` column for custom ordering within categories

  2. Notes
    - Services can be grouped by category (e.g., "Thai Traditional Massage", "Oil Massage", "Wellness Treatments")
    - Display order helps maintain consistent presentation
    - Existing services will have empty category initially
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'category'
  ) THEN
    ALTER TABLE services ADD COLUMN category text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'display_order'
  ) THEN
    ALTER TABLE services ADD COLUMN display_order integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_display_order ON services(display_order);