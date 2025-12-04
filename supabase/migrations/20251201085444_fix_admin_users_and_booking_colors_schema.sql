/*
  # Fix admin_users and booking_form_colors schema issues
  
  1. Make password_hash nullable in admin_users (we use Supabase Auth)
  2. Fix booking_form_colors unique constraint to be per business
*/

-- Fix admin_users: make password_hash nullable since we use Supabase Auth
ALTER TABLE public.admin_users 
  ALTER COLUMN password_hash DROP NOT NULL;

-- Fix booking_form_colors: drop old constraint and add correct one
ALTER TABLE public.booking_form_colors 
  DROP CONSTRAINT IF EXISTS booking_form_colors_color_key_key;

-- Add correct unique constraint: color_key should be unique per business
ALTER TABLE public.booking_form_colors 
  ADD CONSTRAINT booking_form_colors_business_id_color_key_key 
  UNIQUE (business_id, color_key);
