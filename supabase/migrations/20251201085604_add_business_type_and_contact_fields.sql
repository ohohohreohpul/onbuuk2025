/*
  # Add business type and contact fields
  
  1. Changes to businesses table:
    - Add business_type column (salon, massage studio, etc.)
    - Add phone column
    - Add address column
*/

-- Add business type, phone, and address to businesses table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'salon',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text;

-- Add check constraint for valid business types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'businesses_business_type_check'
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_business_type_check 
      CHECK (business_type IN ('salon', 'spa', 'massage_studio', 'barbershop', 'nail_salon', 'wellness_center', 'other'));
  END IF;
END $$;
