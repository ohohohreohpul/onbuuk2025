/*
  # Add Profile Completion and Booking Layout Features

  1. Schema Changes
    - Add `profile_completed` boolean to businesses table
      - Tracks whether business owner has completed their profile setup
      - Default false for new signups

    - Add `booking_form_layout` text to businesses table
      - Stores the selected booking form layout type
      - Options: 'default', 'vertical', 'minimal', 'split-panel'
      - Default 'default' (current 40/60 split layout)

    - Make business fields nullable for simplified signup
      - name, phone, address, business_type can be null initially
      - Allows users to sign up quickly and complete profile later

  2. Data Migration
    - Set profile_completed = true for existing businesses
    - Set booking_form_layout = 'default' for existing businesses
    - Existing businesses are considered complete

  3. Notes
    - Profile completion banner will prompt new users to complete setup
    - Layout selection will be available in admin settings
    - Nullable fields enable faster onboarding
*/

-- Add profile_completed column to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'profile_completed'
  ) THEN
    ALTER TABLE businesses ADD COLUMN profile_completed boolean DEFAULT false;
  END IF;
END $$;

-- Add booking_form_layout column to businesses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'businesses' AND column_name = 'booking_form_layout'
  ) THEN
    ALTER TABLE businesses ADD COLUMN booking_form_layout text DEFAULT 'default'
      CHECK (booking_form_layout IN ('default', 'vertical', 'minimal', 'split-panel'));
  END IF;
END $$;

-- Make business fields nullable for simplified signup
ALTER TABLE businesses ALTER COLUMN name DROP NOT NULL;
ALTER TABLE businesses ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE businesses ALTER COLUMN address DROP NOT NULL;

-- Update existing businesses to mark them as completed
UPDATE businesses
SET profile_completed = true
WHERE name IS NOT NULL AND name != '';

-- Set default layout for existing businesses
UPDATE businesses
SET booking_form_layout = 'default'
WHERE booking_form_layout IS NULL;

-- Create index for faster profile completion checks
CREATE INDEX IF NOT EXISTS idx_businesses_profile_completed ON businesses(profile_completed);

-- Create index for layout queries
CREATE INDEX IF NOT EXISTS idx_businesses_layout ON businesses(booking_form_layout);
