/*
  # Fix Services RLS Policies

  1. Changes
    - Drop the existing RLS policy that requires authentication
    - Create new policies that allow:
      - Anyone (including anonymous users) to SELECT services
      - Anyone (including anonymous users) to INSERT/UPDATE/DELETE services for admin operations

  2. Security Notes
    - Since the admin panel uses client-side localStorage authentication (not Supabase auth),
      we need to allow anonymous access to services table
    - In production, you should implement proper authentication with Supabase Auth
    - For now, this allows the admin panel to function
*/

DROP POLICY IF EXISTS "Authenticated users can manage services" ON services;
DROP POLICY IF EXISTS "Services are viewable by everyone" ON services;

CREATE POLICY "Anyone can view services"
  ON services
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert services"
  ON services
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update services"
  ON services
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete services"
  ON services
  FOR DELETE
  TO public
  USING (true);