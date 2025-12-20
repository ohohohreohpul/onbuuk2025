/*
  # Create Customer Email System

  This migration creates a simple email system for businesses to send emails to their customers.

  1. New Tables
    - `email_settings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `provider` (text) - smtp, sendgrid, mailgun, resend
      - `smtp_host` (text, nullable) - SMTP server host
      - `smtp_port` (integer, nullable) - SMTP port
      - `smtp_username` (text, nullable) - SMTP username
      - `smtp_password` (text, nullable) - SMTP password (encrypted)
      - `api_key` (text, nullable) - API key for providers
      - `from_email` (text) - Sender email address
      - `from_name` (text) - Sender name
      - `is_verified` (boolean) - Whether the email is verified
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `email_templates`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `name` (text) - Template name
      - `subject` (text) - Email subject
      - `body` (text) - Email body (supports HTML)
      - `variables` (jsonb) - Available template variables
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `email_logs`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `customer_id` (uuid, nullable, foreign key to customers)
      - `to_email` (text) - Recipient email
      - `from_email` (text) - Sender email
      - `subject` (text) - Email subject
      - `body` (text) - Email body
      - `status` (text) - sent, failed, pending
      - `error_message` (text, nullable) - Error if failed
      - `sent_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Policies for business isolation
    - Only authenticated business admins can manage emails

  3. Indexes
    - Performance indexes for common queries
*/

-- Create email_settings table
CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'smtp' CHECK (provider IN ('smtp', 'sendgrid', 'mailgun', 'resend')),
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  api_key text,
  from_email text NOT NULL,
  from_name text NOT NULL,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id)
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  from_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_settings
CREATE POLICY "Business admins can view their email settings"
  ON email_settings FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

CREATE POLICY "Business admins can insert their email settings"
  ON email_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

CREATE POLICY "Business admins can update their email settings"
  ON email_settings FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

CREATE POLICY "Business admins can delete their email settings"
  ON email_settings FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

-- RLS Policies for email_templates
CREATE POLICY "Business admins can view their email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

CREATE POLICY "Business admins can insert email templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

CREATE POLICY "Business admins can update their email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

CREATE POLICY "Business admins can delete their email templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

-- RLS Policies for email_logs
CREATE POLICY "Business admins can view their email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

CREATE POLICY "Business admins can insert email logs"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users 
      WHERE email = auth.jwt()->>'email' 
      AND is_active = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_settings_business_id ON email_settings(business_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_business_id ON email_templates(business_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_business_id ON email_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_customer_id ON email_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();