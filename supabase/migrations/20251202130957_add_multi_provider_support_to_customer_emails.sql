/*
  # Add Multi-Provider Support for Customer Emails

  1. Changes to business_email_settings
    - Add provider column (resend, sendgrid, mailgun, smtp, postmark, brevo)
    - Add credential columns for different providers
    - Add configuration status tracking
    - Add test email status

  2. Security
    - Credentials stored in database (encrypted at application level)
    - RLS policies ensure only business owners can access
    - Never expose credentials in logs

  3. Important
    - Platform emails continue to use environment RESEND_API_KEY
    - Customer emails use business's own provider credentials
    - This ensures zero ongoing email costs for platform
*/

ALTER TABLE business_email_settings 
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_username text,
  ADD COLUMN IF NOT EXISTS smtp_password text,
  ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_configured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_status text;

ALTER TABLE business_email_settings
  ADD CONSTRAINT valid_provider CHECK (
    provider IN (
      'not_configured',
      'resend',
      'sendgrid',
      'mailgun',
      'smtp',
      'postmark',
      'brevo'
    )
  );

COMMENT ON COLUMN business_email_settings.provider IS 'Email provider: not_configured, resend, sendgrid, mailgun, smtp, postmark, or brevo';
COMMENT ON COLUMN business_email_settings.api_key IS 'API key for provider (encrypted at application level)';
COMMENT ON COLUMN business_email_settings.provider_configured IS 'Whether the provider has been successfully configured and tested';
COMMENT ON COLUMN business_email_settings.from_email IS 'From email address (required for most providers)';

UPDATE business_email_settings 
SET provider = 'not_configured', 
    provider_configured = false,
    emails_enabled = false
WHERE provider IS NULL;
