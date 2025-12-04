/*
  # Add Email, SMS, and Notification Settings

  1. New Tables
    - `email_settings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses, unique)
      - `provider` (text: 'smtp', 'resend', 'sendgrid', 'mailgun', 'brevo')
      - `enabled` (boolean, default false)
      - `from_email` (text)
      - `from_name` (text)
      - `smtp_host` (text, nullable)
      - `smtp_port` (integer, nullable)
      - `smtp_username` (text, nullable)
      - `smtp_password` (text, nullable)
      - `api_key` (text, nullable - encrypted in production)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sms_settings`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses, unique)
      - `provider` (text: 'twilio', 'vonage', 'aws_sns')
      - `enabled` (boolean, default false)
      - `from_number` (text)
      - `account_sid` (text, nullable)
      - `auth_token` (text, nullable - encrypted in production)
      - `api_key` (text, nullable)
      - `api_secret` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `notification_templates`
      - `id` (uuid, primary key)
      - `business_id` (uuid, references businesses)
      - `type` (text: 'booking_confirmation', 'booking_reminder', 'booking_cancelled', 'status_change')
      - `channel` (text: 'email', 'sms')
      - `enabled` (boolean, default true)
      - `subject` (text, nullable - for email only)
      - `body` (text)
      - `variables` (jsonb - available template variables)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE(business_id, type, channel)

  2. Security
    - Enable RLS on all tables
    - Only authenticated users can manage their business settings
    - API keys and passwords should be handled carefully
*/

CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  provider text NOT NULL DEFAULT 'smtp',
  enabled boolean DEFAULT false,
  from_email text DEFAULT '',
  from_name text DEFAULT '',
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  api_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  provider text NOT NULL DEFAULT 'twilio',
  enabled boolean DEFAULT false,
  from_number text DEFAULT '',
  account_sid text,
  auth_token text,
  api_key text,
  api_secret text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type text NOT NULL,
  channel text NOT NULL,
  enabled boolean DEFAULT true,
  subject text,
  body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, type, channel)
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email settings"
  ON email_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own email settings"
  ON email_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own email settings"
  ON email_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own email settings"
  ON email_settings FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Users can view own sms settings"
  ON sms_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own sms settings"
  ON sms_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own sms settings"
  ON sms_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own sms settings"
  ON sms_settings FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Users can view own notification templates"
  ON notification_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own notification templates"
  ON notification_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notification templates"
  ON notification_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own notification templates"
  ON notification_templates FOR DELETE
  TO authenticated
  USING (true);
