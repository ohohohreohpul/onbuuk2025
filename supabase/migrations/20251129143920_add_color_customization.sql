/*
  # Add Color Customization for Booking Form

  1. New Table
    - `booking_form_colors`
      - `id` (uuid, primary key)
      - `color_key` (text) - Identifier for the color (e.g., 'primary', 'secondary', 'accent', 'text_primary', 'text_secondary', 'background')
      - `color_value` (text) - Hex color value (e.g., '#1c1917')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Allow public read access for the booking form
    - Allow public write access for admin functionality

  3. Default Colors
    - Insert default color scheme matching current stone theme
    - primary: #1c1917 (stone-900)
    - primary_hover: #44403c (stone-700)
    - secondary: #78716c (stone-500)
    - text_primary: #1c1917 (stone-800)
    - text_secondary: #57534e (stone-600)
    - background: #ffffff (white)
    - background_secondary: #fafaf9 (stone-50)
    - border: #e7e5e4 (stone-200)
    - accent: #1c1917 (stone-900)
*/

-- Create booking_form_colors table
CREATE TABLE IF NOT EXISTS booking_form_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  color_key text UNIQUE NOT NULL,
  color_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE booking_form_colors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view booking form colors"
  ON booking_form_colors
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert booking form colors"
  ON booking_form_colors
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update booking form colors"
  ON booking_form_colors
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete booking form colors"
  ON booking_form_colors
  FOR DELETE
  TO public
  USING (true);

-- Insert default colors
INSERT INTO booking_form_colors (color_key, color_value) VALUES
  ('primary', '#1c1917'),
  ('primary_hover', '#44403c'),
  ('secondary', '#78716c'),
  ('text_primary', '#1c1917'),
  ('text_secondary', '#57534e'),
  ('background', '#ffffff'),
  ('background_secondary', '#fafaf9'),
  ('border', '#e7e5e4'),
  ('accent', '#1c1917')
ON CONFLICT (color_key) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_booking_form_colors_key ON booking_form_colors(color_key);
