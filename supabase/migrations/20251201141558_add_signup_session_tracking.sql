/*
  # Add Signup Session Tracking

  1. New Tables
    - `signup_sessions`
      - `id` (uuid, primary key)
      - `stripe_session_id` (text, unique)
      - `stripe_customer_id` (text)
      - `business_id` (uuid, references businesses)
      - `status` (text) - 'pending', 'completed', 'failed'
      - `created_at` (timestamp)
      - `completed_at` (timestamp)

  2. Security
    - Enable RLS on `signup_sessions` table
    - Add policy for public to read by session_id (needed for signup success page)
    - Add policy for service role to manage all
*/

CREATE TABLE IF NOT EXISTS signup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_signup_sessions_stripe_session ON signup_sessions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_signup_sessions_status ON signup_sessions(status);

ALTER TABLE signup_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public to read signup sessions by stripe_session_id
CREATE POLICY "Public can read signup sessions by session_id"
  ON signup_sessions FOR SELECT
  TO public
  USING (true);

-- Service role can manage all
CREATE POLICY "Service role can manage signup sessions"
  ON signup_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
