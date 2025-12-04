/*
  # Add Multi-Language Support to Booking System

  1. Changes to Businesses Table
    - Add `language` column to businesses table
      - Default: 'en' (English)
      - Options: 'en' (English), 'de' (German)
      - Allows each business to set their default language

  2. Changes to Booking Form Customization Tables
    - Add `business_id` foreign key to booking_form_texts, booking_form_images, booking_form_colors
    - Add `language` column to booking_form_texts table
      - Default: 'en'
      - Allows storing translations for each text element
    - Update unique constraint to include business_id and language

  3. Changes to Customers Table
    - Add `preferred_language` column to customers table
      - Default: null (uses business default)
      - Allows customers to choose their preferred language

  4. Purpose
    - Enable businesses to offer booking forms in multiple languages
    - Support German (de) and English (en) initially
    - Extensible for future languages (French, Spanish, etc.)
    - Improve customer experience for international businesses

  5. Security
    - No RLS changes needed - existing policies cover new columns
*/

-- Add language column to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'language'
  ) THEN
    ALTER TABLE businesses ADD COLUMN language text DEFAULT 'en' NOT NULL CHECK (language IN ('en', 'de'));
  END IF;
END $$;

-- Add business_id to booking_form_images if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_images' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE booking_form_images ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_booking_form_images_business ON booking_form_images(business_id);
  END IF;
END $$;

-- Add business_id to booking_form_texts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_texts' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE booking_form_texts ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_booking_form_texts_business ON booking_form_texts(business_id);
  END IF;
END $$;

-- Add language column to booking_form_texts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_texts' AND column_name = 'language'
  ) THEN
    ALTER TABLE booking_form_texts ADD COLUMN language text DEFAULT 'en' NOT NULL CHECK (language IN ('en', 'de'));
  END IF;
END $$;

-- Add business_id to booking_form_colors if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_colors' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE booking_form_colors ADD COLUMN business_id uuid REFERENCES businesses(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_booking_form_colors_business ON booking_form_colors(business_id);
  END IF;
END $$;

-- Drop old unique constraint if it exists and create new one
DO $$
BEGIN
  -- Drop old constraint on booking_form_texts
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'booking_form_texts_step_text_key_key'
  ) THEN
    ALTER TABLE booking_form_texts DROP CONSTRAINT booking_form_texts_step_text_key_key;
  END IF;

  -- Create new unique constraint including business_id and language
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'booking_form_texts_business_step_key_language_unique'
  ) THEN
    ALTER TABLE booking_form_texts 
    ADD CONSTRAINT booking_form_texts_business_step_key_language_unique 
    UNIQUE (business_id, step, text_key, language);
  END IF;
END $$;

-- Add preferred_language to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'preferred_language'
  ) THEN
    ALTER TABLE customers ADD COLUMN preferred_language text CHECK (preferred_language IN ('en', 'de'));
  END IF;
END $$;

-- Create index for faster language queries
CREATE INDEX IF NOT EXISTS idx_businesses_language ON businesses(language);
CREATE INDEX IF NOT EXISTS idx_booking_form_texts_language ON booking_form_texts(business_id, language);
CREATE INDEX IF NOT EXISTS idx_customers_language ON customers(preferred_language);