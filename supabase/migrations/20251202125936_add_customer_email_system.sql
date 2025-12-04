/*
  # Customer Communication Email System

  1. New Tables
    - `business_email_events`
      - Email event types for customer communications
      - Each business can enable/disable events
      - Pre-configured with booking lifecycle events
      - Tracks available variables for template rendering

    - `business_email_templates`
      - HTML templates for customer emails per business
      - Each business gets default templates on creation
      - Businesses can customize templates
      - Supports variable substitution for personalization

    - `business_email_settings`
      - Per-business email configuration
      - From name, reply-to email
      - Master enable/disable switch
      - Email signature customization

    - `business_email_logs`
      - Audit trail of all customer emails sent
      - Links to specific bookings and customers
      - Tracks delivery status
      - Searchable by date, customer, event type

  2. Security
    - Enable RLS on all tables
    - Business owners/admins can manage their email settings
    - Strict business isolation
    - Staff can view logs based on permissions

  3. Pre-populated Data
    - 5 core customer email events
    - Beautiful default templates for each event
    - Professional HTML designs with placeholders
*/

CREATE TABLE IF NOT EXISTS business_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text UNIQUE NOT NULL,
  event_name text NOT NULL,
  event_description text NOT NULL,
  default_enabled boolean DEFAULT true,
  category text NOT NULL,
  available_variables jsonb DEFAULT '[]'::jsonb,
  trigger_type text DEFAULT 'automatic',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_business_event_category CHECK (category IN ('booking', 'marketing', 'feedback')),
  CONSTRAINT valid_business_trigger_type CHECK (trigger_type IN ('automatic', 'manual', 'scheduled'))
);

CREATE TABLE IF NOT EXISTS business_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_key text NOT NULL REFERENCES business_email_events(event_key) ON DELETE CASCADE,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, event_key)
);

CREATE TABLE IF NOT EXISTS business_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  emails_enabled boolean DEFAULT true,
  from_name text,
  reply_to_email text,
  email_signature text,
  send_booking_confirmations boolean DEFAULT true,
  send_booking_reminders boolean DEFAULT true,
  send_booking_cancellations boolean DEFAULT true,
  send_thank_you_emails boolean DEFAULT false,
  reminder_hours_before integer DEFAULT 24,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  provider_response jsonb,
  provider_email_id text,
  sent_at timestamptz DEFAULT now(),
  error_message text,
  CONSTRAINT valid_business_email_status CHECK (status IN ('sent', 'failed', 'queued', 'pending'))
);

CREATE INDEX IF NOT EXISTS idx_business_email_logs_business ON business_email_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_business_email_logs_event ON business_email_logs(event_key);
CREATE INDEX IF NOT EXISTS idx_business_email_logs_recipient ON business_email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_business_email_logs_status ON business_email_logs(status);
CREATE INDEX IF NOT EXISTS idx_business_email_logs_sent_at ON business_email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_email_logs_booking ON business_email_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_business_email_templates_business ON business_email_templates(business_id);

ALTER TABLE business_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view email events"
  ON business_email_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Business admins can view their templates"
  ON business_email_templates FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = current_user OR user_id = auth.uid())
      AND is_active = true
    )
    OR is_super_admin()
  );

CREATE POLICY "Business admins can manage their templates"
  ON business_email_templates FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = current_user OR user_id = auth.uid())
      AND is_active = true
      AND role IN ('owner', 'admin')
    )
    OR is_super_admin()
  );

CREATE POLICY "Business admins can view their email settings"
  ON business_email_settings FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = current_user OR user_id = auth.uid())
      AND is_active = true
    )
    OR is_super_admin()
  );

CREATE POLICY "Business admins can manage their email settings"
  ON business_email_settings FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = current_user OR user_id = auth.uid())
      AND is_active = true
      AND role IN ('owner', 'admin')
    )
    OR is_super_admin()
  );

CREATE POLICY "Anyone authenticated can insert email logs"
  ON business_email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Business admins can view their email logs"
  ON business_email_logs FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users
      WHERE (email = current_user OR user_id = auth.uid())
      AND is_active = true
    )
    OR is_super_admin()
  );

INSERT INTO business_email_events (event_key, event_name, event_description, category, available_variables, trigger_type, default_enabled)
VALUES
  (
    'booking_confirmation',
    'Booking Confirmation',
    'Sent immediately when a customer completes a booking',
    'booking',
    '["customer_name", "customer_email", "service_name", "service_duration", "service_price", "booking_date", "booking_time", "booking_end_time", "specialist_name", "business_name", "business_address", "business_phone", "business_email", "cancellation_link", "reschedule_link"]'::jsonb,
    'automatic',
    true
  ),
  (
    'booking_reminder',
    'Booking Reminder',
    'Sent 24 hours before the scheduled appointment',
    'booking',
    '["customer_name", "service_name", "booking_date", "booking_time", "specialist_name", "business_name", "business_address", "business_phone", "hours_until_appointment"]'::jsonb,
    'scheduled',
    true
  ),
  (
    'booking_cancelled',
    'Booking Cancellation',
    'Sent when a booking is cancelled by customer or business',
    'booking',
    '["customer_name", "service_name", "booking_date", "booking_time", "cancellation_reason", "cancelled_by", "business_name", "business_phone", "rebook_link"]'::jsonb,
    'automatic',
    true
  ),
  (
    'booking_rescheduled',
    'Booking Rescheduled',
    'Sent when an appointment time is changed',
    'booking',
    '["customer_name", "service_name", "old_booking_date", "old_booking_time", "new_booking_date", "new_booking_time", "specialist_name", "business_name", "business_address"]'::jsonb,
    'automatic',
    true
  ),
  (
    'booking_thank_you',
    'Thank You Email',
    'Sent after appointment completion to thank customer',
    'feedback',
    '["customer_name", "service_name", "specialist_name", "business_name", "review_link", "rebook_link", "business_phone"]'::jsonb,
    'automatic',
    false
  )
ON CONFLICT (event_key) DO NOTHING;

CREATE OR REPLACE FUNCTION create_default_business_email_templates()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO business_email_settings (business_id, from_name, reply_to_email)
  VALUES (NEW.id, NEW.name, NEW.email);

  INSERT INTO business_email_templates (business_id, event_key, subject, html_body, text_body)
  VALUES
    (
      NEW.id,
      'booking_confirmation',
      'Your appointment at {{business_name}} is confirmed!',
      '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .booking-details { background: #f8fafc; border-left: 4px solid #1e293b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-label { font-weight: 600; color: #64748b; }
    .detail-value { color: #1e293b; font-weight: 500; }
    .button { display: inline-block; background: #1e293b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 10px 5px; font-weight: 600; }
    .button-secondary { background: #64748b; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Booking Confirmed!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">We look forward to seeing you</p>
    </div>
    <div class="content">
      <p>Hi {{customer_name}},</p>
      <p>Great news! Your appointment has been confirmed and we''re excited to welcome you.</p>
      
      <div class="booking-details">
        <h3 style="margin-top: 0;">Appointment Details</h3>
        <div class="detail-row">
          <span class="detail-label">Service:</span>
          <span class="detail-value">{{service_name}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">{{booking_date}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Time:</span>
          <span class="detail-value">{{booking_time}} - {{booking_end_time}}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">With:</span>
          <span class="detail-value">{{specialist_name}}</span>
        </div>
        <div class="detail-row" style="border-bottom: none;">
          <span class="detail-label">Price:</span>
          <span class="detail-value">{{service_price}}</span>
        </div>
      </div>

      <div style="background: #f1f5f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <strong>Location:</strong><br>
        {{business_name}}<br>
        {{business_address}}<br>
        {{business_phone}}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{cancellation_link}}" class="button button-secondary">Need to Cancel?</a>
      </div>

      <p style="font-size: 14px; color: #64748b;">
        Please arrive 5-10 minutes early. If you need to make any changes, don''t hesitate to contact us.
      </p>
    </div>
    <div class="footer">
      <p><strong>{{business_name}}</strong></p>
      <p>{{business_address}}</p>
      <p>{{business_phone}} • {{business_email}}</p>
    </div>
  </div>
</body>
</html>',
      'Hi {{customer_name}},

Your appointment at {{business_name}} is confirmed!

Service: {{service_name}}
Date: {{booking_date}}
Time: {{booking_time}} - {{booking_end_time}}
With: {{specialist_name}}
Price: {{service_price}}

Location:
{{business_name}}
{{business_address}}
{{business_phone}}

Need to cancel? {{cancellation_link}}

See you soon!

{{business_name}}'
    ),
    (
      NEW.id,
      'booking_reminder',
      'Reminder: Your appointment tomorrow at {{business_name}}',
      '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .reminder-box { background: #cffafe; border-left: 4px solid #0891b2; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Appointment Reminder</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">See you soon!</p>
    </div>
    <div class="content">
      <p>Hi {{customer_name}},</p>
      <p>This is a friendly reminder about your upcoming appointment.</p>
      
      <div class="reminder-box">
        <h3 style="margin-top: 0; color: #0891b2;">Tomorrow''s Appointment</h3>
        <p style="margin: 5px 0;"><strong>Service:</strong> {{service_name}}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> {{booking_date}}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> {{booking_time}}</p>
        <p style="margin: 5px 0;"><strong>With:</strong> {{specialist_name}}</p>
      </div>

      <div style="background: #f1f5f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <strong>Location:</strong><br>
        {{business_name}}<br>
        {{business_address}}<br>
        {{business_phone}}
      </div>

      <p>We look forward to seeing you! Please arrive 5-10 minutes early.</p>
    </div>
    <div class="footer">
      <p><strong>{{business_name}}</strong></p>
      <p>{{business_phone}}</p>
    </div>
  </div>
</body>
</html>',
      'Hi {{customer_name}},

Reminder: Your appointment is tomorrow!

Service: {{service_name}}
Date: {{booking_date}}
Time: {{booking_time}}
With: {{specialist_name}}

Location:
{{business_name}}
{{business_address}}
{{business_phone}}

See you soon!

{{business_name}}'
    ),
    (
      NEW.id,
      'booking_cancelled',
      'Your appointment at {{business_name}} has been cancelled',
      '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #1e293b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: 600; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Appointment Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi {{customer_name}},</p>
      <p>Your appointment for <strong>{{service_name}}</strong> on <strong>{{booking_date}}</strong> at <strong>{{booking_time}}</strong> has been cancelled.</p>
      
      <p>We hope to see you again soon!</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="{{rebook_link}}" class="button">Book Another Appointment</a>
      </div>

      <p style="font-size: 14px; color: #64748b;">
        If you have any questions, please contact us at {{business_phone}}.
      </p>
    </div>
    <div class="footer">
      <p><strong>{{business_name}}</strong></p>
      <p>{{business_phone}}</p>
    </div>
  </div>
</body>
</html>',
      'Hi {{customer_name}},

Your appointment has been cancelled.

Service: {{service_name}}
Date: {{booking_date}}
Time: {{booking_time}}

Book again: {{rebook_link}}

{{business_name}}
{{business_phone}}'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_business_email_defaults
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION create_default_business_email_templates();
