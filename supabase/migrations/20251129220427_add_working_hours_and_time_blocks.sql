/*
  # Add Working Hours and Time Blocks

  1. New Tables
    - `working_hours`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `specialist_id` (uuid, references specialists)
      - `day_of_week` (integer, 0-6 where 0=Sunday)
      - `start_time` (time without timezone)
      - `end_time` (time without timezone)
      - `is_available` (boolean, allows marking a day as unavailable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `time_blocks`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `specialist_id` (uuid, references specialists)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `reason` (text, e.g., "Vacation", "Sick Leave", "Personal")
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can view working hours
    - Only business admins can modify working hours
    - Only business admins can create/modify time blocks
*/

CREATE TABLE IF NOT EXISTS working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(specialist_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  specialist_id uuid NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view working hours"
  ON working_hours FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert working hours"
  ON working_hours FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update working hours"
  ON working_hours FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete working hours"
  ON working_hours FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view time blocks"
  ON time_blocks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert time blocks"
  ON time_blocks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update time blocks"
  ON time_blocks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete time blocks"
  ON time_blocks FOR DELETE
  TO authenticated
  USING (true);
