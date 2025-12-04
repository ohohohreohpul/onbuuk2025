/*
  # Fix Site Settings RLS Policies

  1. Problem
    - Current policy uses "ALL" which may not properly handle INSERT/UPDATE/DELETE
    - Authenticated users from admin_users need explicit permissions

  2. Changes
    - Drop existing broad policy
    - Create specific policies for SELECT, INSERT, UPDATE, DELETE
    - Ensure admin users can manage settings for their business

  3. Security
    - Only authenticated admin users can modify settings
    - Settings must belong to their business
    - Anonymous users can read public settings
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can manage their business settings" ON site_settings;
DROP POLICY IF EXISTS "Site settings viewable by business" ON site_settings;

-- Allow anyone to read site settings (for public booking pages)
CREATE POLICY "Anyone can view site settings"
  ON site_settings FOR SELECT
  TO public
  USING (business_id IS NOT NULL);

-- Allow authenticated admin users to insert settings for their business
CREATE POLICY "Admins can insert site settings"
  ON site_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Allow authenticated admin users to update settings for their business
CREATE POLICY "Admins can update site settings"
  ON site_settings FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Allow authenticated admin users to delete settings for their business
CREATE POLICY "Admins can delete site settings"
  ON site_settings FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users WHERE id = auth.uid()
    )
  );