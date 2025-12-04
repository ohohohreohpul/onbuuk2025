/*
  # Fix Service Durations RLS Policies

  1. Changes
    - Drop the existing RLS policy that requires authentication
    - Create new policies that allow anonymous access for admin operations

  2. Security Notes
    - Matching the services table policies for consistency
    - Allows admin panel to function without Supabase authentication
*/

DROP POLICY IF EXISTS "Authenticated users can manage service durations" ON service_durations;
DROP POLICY IF EXISTS "Service durations are viewable by everyone" ON service_durations;

CREATE POLICY "Anyone can view service durations"
  ON service_durations
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert service durations"
  ON service_durations
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update service durations"
  ON service_durations
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete service durations"
  ON service_durations
  FOR DELETE
  TO public
  USING (true);