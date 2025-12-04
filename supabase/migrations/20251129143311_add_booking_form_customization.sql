/*
  # Add Booking Form Customization Tables

  1. New Tables
    - `booking_form_images`
      - `id` (uuid, primary key)
      - `step` (text) - Which booking step this image is for (welcome, service, duration, specialist, datetime, personal_details, payment, or 'default' for all)
      - `image_url` (text) - URL to the uploaded image
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `booking_form_texts`
      - `id` (uuid, primary key)
      - `step` (text) - Which booking step this text is for
      - `text_key` (text) - Identifier for the text element (e.g., 'title', 'subtitle', 'description')
      - `text_value` (text) - The actual text content
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Allow public read access for the booking form
    - Allow public write access for admin functionality (matching existing admin pattern)

  3. Notes
    - Image management will use Supabase Storage
    - Text customization allows admin to override any text on any booking step
    - Step value 'default' for images means use the same image across all steps
*/

-- Create booking_form_images table
CREATE TABLE IF NOT EXISTS booking_form_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create booking_form_texts table
CREATE TABLE IF NOT EXISTS booking_form_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step text NOT NULL,
  text_key text NOT NULL,
  text_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(step, text_key)
);

-- Enable RLS
ALTER TABLE booking_form_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_form_texts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_form_images
CREATE POLICY "Anyone can view booking form images"
  ON booking_form_images
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert booking form images"
  ON booking_form_images
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update booking form images"
  ON booking_form_images
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete booking form images"
  ON booking_form_images
  FOR DELETE
  TO public
  USING (true);

-- RLS Policies for booking_form_texts
CREATE POLICY "Anyone can view booking form texts"
  ON booking_form_texts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert booking form texts"
  ON booking_form_texts
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update booking form texts"
  ON booking_form_texts
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete booking form texts"
  ON booking_form_texts
  FOR DELETE
  TO public
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_booking_form_images_step ON booking_form_images(step);
CREATE INDEX IF NOT EXISTS idx_booking_form_texts_step_key ON booking_form_texts(step, text_key);
