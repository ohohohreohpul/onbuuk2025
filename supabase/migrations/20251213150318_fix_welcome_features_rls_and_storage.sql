/*
  # Fix Welcome Features RLS and Storage

  1. Changes
    - Create storage bucket for business assets if not exists
    - Fix RLS policies on welcome_feature_cards to allow public read access
    - Add storage policies for authenticated uploads

  2. Security
    - Public can read enabled cards
    - Authenticated users can upload to their business folder
*/

-- Create storage bucket for business assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Anyone can view enabled welcome cards" ON welcome_feature_cards;
DROP POLICY IF EXISTS "Business admins can view their welcome cards" ON welcome_feature_cards;

-- Recreate with better access
CREATE POLICY "Public can view enabled welcome cards"
  ON welcome_feature_cards FOR SELECT
  TO public
  USING (is_enabled = true);

CREATE POLICY "Authenticated can view all welcome cards"
  ON welcome_feature_cards FOR SELECT
  TO authenticated
  USING (true);

-- Storage policies for business-assets bucket
CREATE POLICY "Authenticated users can upload business assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'business-assets');

CREATE POLICY "Anyone can view business assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-assets');

CREATE POLICY "Authenticated users can update their business assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'business-assets');

CREATE POLICY "Authenticated users can delete their business assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'business-assets');
