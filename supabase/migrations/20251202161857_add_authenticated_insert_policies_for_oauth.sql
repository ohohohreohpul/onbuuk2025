/*
  # Add Authenticated INSERT Policies for OAuth Users

  1. Changes
    - Add INSERT policy for authenticated users on admin_users table
    - Add INSERT policy for authenticated users on booking_form_colors table

  2. Reasoning
    - OAuth users have 'authenticated' role, not 'public' role
    - Existing policies only allowed 'public' (anonymous) users to INSERT
    - This caused OAuth signup to fail with setup_failed error
    - businesses table already has authenticated policy (works fine)
    - These two policies complete the OAuth flow
*/

-- Allow authenticated users (OAuth) to create admin_users
CREATE POLICY "Authenticated users can create admin users"
  ON admin_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users (OAuth) to create booking colors  
CREATE POLICY "Authenticated users can create booking colors"
  ON booking_form_colors FOR INSERT
  TO authenticated
  WITH CHECK (true);
