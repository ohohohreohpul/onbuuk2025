/*
  # Platform Email System

  1. New Tables
    - `platform_email_events`
      - Stores all available email event types (staff_invitation, business_welcome, etc.)
      - Controls which events are enabled/disabled globally
      - Defines available variables for template rendering per event
      - Categorizes events (staff, business, admin, security)

    - `platform_email_templates`
      - Stores HTML email templates for each event
      - Multiple templates per event for A/B testing
      - One template marked as default/active per event
      - Includes subject, HTML body, text fallback
      - Preview data for testing templates

    - `platform_email_settings`
      - Single-row configuration table for platform-wide email settings
      - Stores email provider configuration (Resend)
      - Rate limiting and daily send limits
      - Default sender information

    - `platform_email_logs`
      - Audit trail of all platform emails sent
      - Tracks success/failure status
      - Links to business (if applicable)
      - Stores provider responses for debugging
      - Searchable by recipient, event type, status

  2. Security
    - Enable RLS on all tables
    - Only super admins can manage email configuration
    - Logs are insertable by anyone for tracking
    - Super admins can view all logs

  3. Pre-populated Data
    - Default email events for common use cases
    - Professional email templates ready to use
    - Initial settings configuration
*/

CREATE TABLE IF NOT EXISTS platform_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  event_name text NOT NULL,
  event_description text NOT NULL,
  enabled boolean DEFAULT true,
  category text NOT NULL,
  available_variables jsonb DEFAULT '[]'::jsonb,
  trigger_type text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_category CHECK (category IN ('staff', 'business', 'admin', 'security', 'system')),
  CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('manual', 'automatic', 'scheduled'))
);

CREATE TABLE IF NOT EXISTS platform_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL REFERENCES platform_email_events(event_key) ON DELETE CASCADE,
  template_name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  from_name text DEFAULT 'Buuk',
  from_email text DEFAULT 'onboarding@resend.dev',
  reply_to text,
  is_default boolean DEFAULT false,
  preview_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_key, template_name)
);

CREATE TABLE IF NOT EXISTS platform_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text DEFAULT 'resend',
  api_key_configured boolean DEFAULT false,
  default_from_email text DEFAULT 'onboarding@resend.dev',
  default_from_name text DEFAULT 'Buuk',
  default_reply_to text,
  daily_limit integer DEFAULT 1000,
  rate_limit_per_minute integer DEFAULT 60,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  provider_response jsonb,
  provider_email_id text,
  sent_at timestamptz DEFAULT now(),
  error_message text,
  CONSTRAINT valid_status CHECK (status IN ('sent', 'failed', 'queued', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_event ON platform_email_logs(event_key);
CREATE INDEX IF NOT EXISTS idx_platform_email_logs_recipient ON platform_email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_platform_email_logs_status ON platform_email_logs(status);
CREATE INDEX IF NOT EXISTS idx_platform_email_logs_sent_at ON platform_email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_email_logs_business ON platform_email_logs(business_id);

ALTER TABLE platform_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view email events"
  ON platform_email_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage email events"
  ON platform_email_events FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Anyone can view email templates"
  ON platform_email_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage email templates"
  ON platform_email_templates FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can view email settings"
  ON platform_email_settings FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can manage email settings"
  ON platform_email_settings FOR ALL
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Anyone can insert email logs"
  ON platform_email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Super admins can view all email logs"
  ON platform_email_logs FOR SELECT
  TO authenticated
  USING (is_super_admin());

INSERT INTO platform_email_events (event_key, event_name, event_description, category, available_variables, trigger_type)
VALUES
  (
    'staff_invitation',
    'Staff Invitation',
    'Sent when an admin invites a new staff member to join their business',
    'staff',
    '["business_name", "staff_name", "staff_email", "role", "invite_url", "invite_expires_at"]'::jsonb,
    'manual'
  ),
  (
    'staff_welcome',
    'Staff Welcome',
    'Sent after a staff member accepts their invitation and creates an account',
    'staff',
    '["business_name", "staff_name", "role", "dashboard_url"]'::jsonb,
    'automatic'
  ),
  (
    'staff_access_revoked',
    'Staff Access Revoked',
    'Sent when a staff member account is deactivated',
    'staff',
    '["business_name", "staff_name", "revoked_by"]'::jsonb,
    'automatic'
  ),
  (
    'business_welcome',
    'Business Welcome',
    'Sent when a new business completes signup',
    'business',
    '["business_name", "owner_name", "owner_email", "permalink", "dashboard_url", "setup_guide_url"]'::jsonb,
    'automatic'
  ),
  (
    'business_trial_ending',
    'Trial Ending Soon',
    'Sent 3 days before a business trial expires',
    'business',
    '["business_name", "owner_name", "trial_ends_at", "upgrade_url", "days_remaining"]'::jsonb,
    'scheduled'
  ),
  (
    'business_trial_ended',
    'Trial Expired',
    'Sent when a business trial period ends',
    'business',
    '["business_name", "owner_name", "upgrade_url"]'::jsonb,
    'scheduled'
  ),
  (
    'business_upgraded',
    'Upgrade Confirmed',
    'Sent when a business upgrades to a paid plan',
    'business',
    '["business_name", "owner_name", "plan_name", "features"]'::jsonb,
    'automatic'
  ),
  (
    'business_payment_failed',
    'Payment Failed',
    'Sent when a subscription payment fails',
    'business',
    '["business_name", "owner_name", "plan_name", "retry_date", "update_payment_url"]'::jsonb,
    'automatic'
  ),
  (
    'admin_password_reset',
    'Password Reset Request',
    'Sent when an admin requests a password reset',
    'security',
    '["admin_name", "admin_email", "reset_url", "expires_at"]'::jsonb,
    'manual'
  ),
  (
    'admin_login_alert',
    'New Login Detected',
    'Sent when an admin logs in from a new device or location',
    'security',
    '["admin_name", "device", "location", "timestamp", "secure_account_url"]'::jsonb,
    'automatic'
  ),
  (
    'suspicious_activity',
    'Suspicious Activity Alert',
    'Sent when suspicious activity is detected on an account',
    'security',
    '["admin_name", "activity_description", "timestamp", "secure_account_url"]'::jsonb,
    'automatic'
  ),
  (
    'daily_admin_digest',
    'Daily Admin Digest',
    'Daily summary of important metrics and activities',
    'system',
    '["business_name", "date", "bookings_count", "revenue", "new_customers", "highlights"]'::jsonb,
    'scheduled'
  )
ON CONFLICT (event_key) DO NOTHING;

INSERT INTO platform_email_templates (event_key, template_name, subject, html_body, text_body, is_default, preview_data)
VALUES
  (
    'staff_invitation',
    'Professional Invitation',
    'You''re invited to join {{business_name}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .button { display: inline-block; background: #1e293b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .role-badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 600; text-transform: capitalize; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
    .info-box { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>You''re Invited to Join {{business_name}}</h1>
  </div>
  <div class="content">
    <p>Hi {{staff_name}},</p>
    <p>Great news! You''ve been invited to join <strong>{{business_name}}</strong> as a <span class="role-badge">{{role}}</span>.</p>
    <div class="info-box">
      <strong>What''s Next?</strong>
      <ol style="margin: 10px 0; padding-left: 20px;">
        <li>Click the button below to accept your invitation</li>
        <li>Create your secure password</li>
        <li>Start accessing your portal immediately</li>
      </ol>
    </div>
    <div style="text-align: center;">
      <a href="{{invite_url}}" class="button">Accept Invitation & Create Account</a>
    </div>
    <p style="font-size: 14px; color: #6b7280;">Or copy and paste this link into your browser:<br><a href="{{invite_url}}" style="color: #4338ca; word-break: break-all;">{{invite_url}}</a></p>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;"><strong>Important:</strong> This invitation link will expire on {{invite_expires_at}}. If you didn''t expect this invitation, please contact your administrator.</p>
  </div>
  <div class="footer">
    <p>This is an automated message from {{business_name}}</p>
    <p>Please do not reply to this email</p>
  </div>
</body>
</html>',
    'Hi {{staff_name}},

You''ve been invited to join {{business_name}} as a {{role}}.

Click here to accept: {{invite_url}}

This link expires on {{invite_expires_at}}.

This is an automated message from {{business_name}}.',
    true,
    '{"business_name": "Spa Paradise", "staff_name": "John Doe", "staff_email": "john@example.com", "role": "Receptionist", "invite_url": "https://app.buuk.com/accept-invite?token=abc123", "invite_expires_at": "December 9, 2024"}'::jsonb
  ),
  (
    'business_welcome',
    'Welcome to Buuk',
    'Welcome to Buuk, {{owner_name}}!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 40px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; }
    .button { display: inline-block; background: #0891b2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: 600; }
    .card { background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to Buuk!</h1>
    <p style="font-size: 18px; margin-top: 10px;">Your business is now live</p>
  </div>
  <div class="content">
    <p>Hi {{owner_name}},</p>
    <p>Congratulations! <strong>{{business_name}}</strong> is now set up and ready to start accepting bookings.</p>
    <div class="card">
      <h3 style="margin-top: 0;">Your Booking Page:</h3>
      <p><a href="{{permalink}}" style="color: #0891b2; font-weight: 600;">{{permalink}}</a></p>
    </div>
    <h3>Quick Start Guide:</h3>
    <ol style="padding-left: 20px;">
      <li><strong>Set up your services:</strong> Add the services you offer</li>
      <li><strong>Configure availability:</strong> Set your working hours</li>
      <li><strong>Customize your booking page:</strong> Add your branding</li>
      <li><strong>Invite your team:</strong> Add staff members</li>
    </ol>
    <div style="text-align: center; margin-top: 30px;">
      <a href="{{dashboard_url}}" class="button">Go to Dashboard</a>
      <a href="{{setup_guide_url}}" class="button" style="background: #6b7280;">View Setup Guide</a>
    </div>
    <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">Need help? We''re here for you! Reply to this email or visit our help center.</p>
  </div>
  <div class="footer">
    <p>The Buuk Team</p>
  </div>
</body>
</html>',
    'Hi {{owner_name}},

Welcome to Buuk! {{business_name}} is now live and ready to accept bookings.

Your booking page: {{permalink}}

Get started:
1. Set up your services
2. Configure availability
3. Customize your booking page
4. Invite your team

Dashboard: {{dashboard_url}}
Setup Guide: {{setup_guide_url}}

The Buuk Team',
    true,
    '{"business_name": "Spa Paradise", "owner_name": "Jane Smith", "owner_email": "jane@spaparadise.com", "permalink": "https://book.buuk.com/spaparadise", "dashboard_url": "https://app.buuk.com/admin", "setup_guide_url": "https://help.buuk.com/setup"}'::jsonb
  )
ON CONFLICT (event_key, template_name) DO NOTHING;

INSERT INTO platform_email_settings (api_key_configured, default_from_email, default_from_name)
VALUES (true, 'onboarding@resend.dev', 'Buuk')
ON CONFLICT DO NOTHING;
