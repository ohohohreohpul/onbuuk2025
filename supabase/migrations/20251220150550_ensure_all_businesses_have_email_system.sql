/*
  # Ensure All Businesses Have Email System

  1. Changes
    - Create email settings for businesses that don't have them
    - Create default email templates for businesses missing them
    - Set emails_enabled to false by default (require explicit opt-in)
    - Set provider to 'not_configured' by default

  2. Security
    - Only creates missing records, doesn't modify existing ones
    - Maintains RLS policies
    - Safe to run multiple times (idempotent)

  3. Important
    - Businesses must explicitly configure their email provider
    - Emails are disabled by default for data safety
    - Templates are created so businesses can customize them
*/

-- Insert email settings for businesses that don't have them
INSERT INTO business_email_settings (
  business_id,
  emails_enabled,
  from_name,
  reply_to_email,
  send_booking_confirmations,
  send_booking_reminders,
  send_booking_cancellations,
  send_thank_you_emails,
  reminder_hours_before,
  provider,
  provider_configured
)
SELECT
  b.id,
  false,
  b.name,
  NULL,
  true,
  true,
  true,
  false,
  24,
  'not_configured',
  false
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM business_email_settings bes
  WHERE bes.business_id = b.id
);

-- Insert default booking confirmation template for businesses that don't have it
INSERT INTO business_email_templates (business_id, event_key, subject, html_body, text_body, is_active)
SELECT
  b.id,
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

{{business_name}}',
  true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM business_email_templates bet
  WHERE bet.business_id = b.id AND bet.event_key = 'booking_confirmation'
);

-- Insert default booking reminder template for businesses that don't have it
INSERT INTO business_email_templates (business_id, event_key, subject, html_body, text_body, is_active)
SELECT
  b.id,
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

{{business_name}}',
  true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM business_email_templates bet
  WHERE bet.business_id = b.id AND bet.event_key = 'booking_reminder'
);

-- Insert default booking cancellation template for businesses that don't have it
INSERT INTO business_email_templates (business_id, event_key, subject, html_body, text_body, is_active)
SELECT
  b.id,
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
{{business_phone}}',
  true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM business_email_templates bet
  WHERE bet.business_id = b.id AND bet.event_key = 'booking_cancelled'
);