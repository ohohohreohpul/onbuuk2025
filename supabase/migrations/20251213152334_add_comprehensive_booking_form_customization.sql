/*
  # Comprehensive Booking Form Customization System

  1. New Table: booking_form_customization
    - Stores all customizable text, images, and styling for each booking step
    - Supports per-step customization (welcome, service, duration, specialist, datetime, details, addons, payment)
    - Includes color scheme and typography settings
    - One-to-one relationship with businesses

  2. Customization Categories:
    - **Step Content**: Title, subtitle, helper text, button labels for each step
    - **Images**: Background/header images for each step
    - **Colors**: Primary, secondary, accent, background, text colors
    - **Typography**: Font family, sizes, weights
    - **Form Fields**: Custom labels for personal details fields
    - **General**: Progress bar style, animations, spacing

  3. Security:
    - Enable RLS on booking_form_customization table
    - Admins can manage their business's customization
    - Public users can read customization for booking flow

  4. Features:
    - JSONB fields for flexible step-by-step customization
    - Separate image URLs for each step
    - Complete color palette control
    - Form field label customization
    - RTL/LTR layout support
*/

-- Create booking_form_customization table
CREATE TABLE IF NOT EXISTS booking_form_customization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Step-by-step text customization (JSONB for flexibility)
  welcome_step jsonb DEFAULT '{
    "title": "Welcome! Let''s get you booked",
    "subtitle": "Choose your preferred service and time",
    "buttonText": "Get Started"
  }'::jsonb,
  
  service_step jsonb DEFAULT '{
    "title": "Choose Your Service",
    "subtitle": "Select the service you would like to book",
    "buttonText": "Continue"
  }'::jsonb,
  
  duration_step jsonb DEFAULT '{
    "title": "Select Duration",
    "subtitle": "How long would you like your appointment?",
    "buttonText": "Continue"
  }'::jsonb,
  
  specialist_step jsonb DEFAULT '{
    "title": "Choose Your Specialist",
    "subtitle": "Select your preferred specialist or let us choose for you",
    "buttonText": "Continue",
    "anySpecialistText": "Any Available Specialist"
  }'::jsonb,
  
  datetime_step jsonb DEFAULT '{
    "title": "Select Date & Time",
    "subtitle": "Choose your preferred appointment date and time",
    "buttonText": "Continue"
  }'::jsonb,
  
  details_step jsonb DEFAULT '{
    "title": "Your Details",
    "subtitle": "Please provide your contact information",
    "buttonText": "Continue",
    "labels": {
      "name": "Full Name",
      "email": "Email Address",
      "phone": "Phone Number",
      "notes": "Additional Notes (Optional)"
    }
  }'::jsonb,
  
  addons_step jsonb DEFAULT '{
    "title": "Enhance Your Experience",
    "subtitle": "Add optional products or services",
    "buttonText": "Continue",
    "skipButtonText": "Skip Add-ons"
  }'::jsonb,
  
  payment_step jsonb DEFAULT '{
    "title": "Payment",
    "subtitle": "Complete your booking",
    "buttonText": "Confirm Booking"
  }'::jsonb,
  
  -- Image URLs for each step (can be background or header images)
  welcome_image_url text,
  service_image_url text,
  duration_image_url text,
  specialist_image_url text,
  datetime_image_url text,
  details_image_url text,
  addons_image_url text,
  payment_image_url text,
  
  -- Color scheme customization
  colors jsonb DEFAULT '{
    "primary": "#2563eb",
    "secondary": "#64748b",
    "accent": "#3b82f6",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#1e293b",
    "textSecondary": "#64748b",
    "border": "#e2e8f0",
    "success": "#22c55e",
    "error": "#ef4444",
    "warning": "#f59e0b"
  }'::jsonb,
  
  -- Typography settings
  typography jsonb DEFAULT '{
    "fontFamily": "system-ui, -apple-system, sans-serif",
    "headingSize": "2xl",
    "bodySize": "base",
    "headingWeight": "bold",
    "bodyWeight": "normal"
  }'::jsonb,
  
  -- General styling options
  styling jsonb DEFAULT '{
    "borderRadius": "md",
    "spacing": "normal",
    "shadowLevel": "md",
    "progressBarStyle": "steps",
    "showStepNumbers": true,
    "animationsEnabled": true,
    "layout": "split"
  }'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE booking_form_customization ENABLE ROW LEVEL SECURITY;

-- Admins can view their business's customization
CREATE POLICY "Admins can view their business customization"
  ON booking_form_customization
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Admins can insert customization for their business
CREATE POLICY "Admins can insert their business customization"
  ON booking_form_customization
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Admins can update their business's customization
CREATE POLICY "Admins can update their business customization"
  ON booking_form_customization
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE auth_user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Public users can read customization for booking flow
CREATE POLICY "Public can read booking form customization"
  ON booking_form_customization
  FOR SELECT
  TO public
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_form_customization_business 
  ON booking_form_customization(business_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_booking_form_customization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_booking_form_customization_updated_at
  BEFORE UPDATE ON booking_form_customization
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_form_customization_updated_at();