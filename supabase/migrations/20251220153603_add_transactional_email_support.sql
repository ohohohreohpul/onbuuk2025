/*
  # Add Transactional Email Support

  This migration adds support for event-based transactional emails (booking confirmations, gift cards, etc.)

  1. Changes to email_templates
    - Add `event_key` (text, nullable) - Identifies the event type (booking_confirmation, gift_card_received, etc.)
    - Add `is_system_default` (boolean) - Marks templates as system defaults
    - Add `is_enabled` (boolean) - Allow businesses to enable/disable specific templates
    - Add unique constraint on (business_id, event_key) for event-based templates
    - Make `name` nullable since event_key can serve as identifier

  2. Default Transactional Email Templates
    - booking_confirmation - Sent when booking is confirmed/paid
    - booking_cancelled - Sent when booking is cancelled
    - gift_card_received - Sent to gift card recipient with code
    - gift_card_purchased - Sent to purchaser as receipt

  3. Security
    - Update RLS policies to support service role access for automated emails
    - Edge functions need to read templates and insert logs

  4. Available Template Variables
    Each template type has specific variables that can be used:

    booking_confirmation:
      - customer_name, customer_email
      - service_name, service_duration, service_price
      - booking_date, booking_time, booking_end_time
      - specialist_name
      - business_name, business_address, business_phone, business_email
      - cancellation_link, reschedule_link

    booking_cancelled:
      - customer_name
      - service_name, booking_date, booking_time
      - cancellation_reason, cancelled_by
      - business_name, business_phone
      - rebook_link

    gift_card_received:
      - recipient_email
      - gift_card_code, amount, message
      - sender_name
      - business_name

    gift_card_purchased:
      - customer_name, customer_email
      - gift_card_code, amount
      - recipient_email, message
      - business_name
*/

-- Add new columns to email_templates
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS is_system_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;

-- Make name nullable since event_key can serve as identifier
ALTER TABLE email_templates
  ALTER COLUMN name DROP NOT NULL;

-- Add unique constraint for event-based templates
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_business_event
  ON email_templates(business_id, event_key)
  WHERE event_key IS NOT NULL;

-- Add index for event_key lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_event_key
  ON email_templates(event_key)
  WHERE event_key IS NOT NULL;

-- Update RLS policies to allow service role to read templates
CREATE POLICY "Service role can read email templates for sending"
  ON email_templates FOR SELECT
  TO service_role
  USING (true);

-- Update RLS policies to allow service role to insert logs
CREATE POLICY "Service role can insert email logs"
  ON email_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Update RLS policies to allow service role to read settings
CREATE POLICY "Service role can read email settings for sending"
  ON email_settings FOR SELECT
  TO service_role
  USING (true);

-- Function to create default transactional templates for a business
CREATE OR REPLACE FUNCTION create_default_transactional_templates(p_business_id uuid)
RETURNS void AS $$
BEGIN
  -- Booking Confirmation Template
  INSERT INTO email_templates (business_id, event_key, name, subject, body, is_system_default, is_enabled, variables)
  VALUES (
    p_business_id,
    'booking_confirmation',
    'Booking Confirmation',
    'Your Booking Confirmation - {{service_name}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #1c1917; margin: 0 0 10px 0; font-size: 28px;">Booking Confirmed!</h1>
    <p style="color: #57534e; margin: 0; font-size: 16px;">Thank you for your booking, {{customer_name}}.</p>
  </div>

  <div style="background-color: #ffffff; padding: 25px; border: 1px solid #e7e5e4; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1c1917; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #1c1917; padding-bottom: 10px;">Appointment Details</h2>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; color: #57534e; font-weight: 500;">Service:</td>
        <td style="padding: 10px 0; color: #1c1917; text-align: right;"><strong>{{service_name}}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #57534e; font-weight: 500;">Duration:</td>
        <td style="padding: 10px 0; color: #1c1917; text-align: right;">{{service_duration}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #57534e; font-weight: 500;">Price:</td>
        <td style="padding: 10px 0; color: #1c1917; text-align: right;">{{service_price}}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #57534e; font-weight: 500;">Date:</td>
        <td style="padding: 10px 0; color: #1c1917; text-align: right;"><strong>{{booking_date}}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #57534e; font-weight: 500;">Time:</td>
        <td style="padding: 10px 0; color: #1c1917; text-align: right;"><strong>{{booking_time}} - {{booking_end_time}}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #57534e; font-weight: 500;">Specialist:</td>
        <td style="padding: 10px 0; color: #1c1917; text-align: right;">{{specialist_name}}</td>
      </tr>
    </table>
  </div>

  <div style="background-color: #fafaf9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h3 style="color: #1c1917; margin: 0 0 15px 0; font-size: 16px;">Location</h3>
    <p style="margin: 0 0 5px 0; color: #1c1917;"><strong>{{business_name}}</strong></p>
    <p style="margin: 0 0 5px 0; color: #57534e;">{{business_address}}</p>
    <p style="margin: 0; color: #57534e;">{{business_phone}}</p>
  </div>

  <div style="text-align: center; margin-top: 30px;">
    <a href="{{cancellation_link}}" style="display: inline-block; background-color: #1c1917; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 500; margin: 0 5px;">Cancel Booking</a>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center; color: #78716c; font-size: 14px;">
    <p style="margin: 0 0 10px 0;">Please arrive 10 minutes before your appointment time.</p>
    <p style="margin: 0;">For questions, contact us at {{business_phone}}</p>
  </div>
</body>
</html>',
    true,
    true,
    '["customer_name", "customer_email", "service_name", "service_duration", "service_price", "booking_date", "booking_time", "booking_end_time", "specialist_name", "business_name", "business_address", "business_phone", "business_email", "cancellation_link", "reschedule_link"]'::jsonb
  )
  ON CONFLICT (business_id, event_key) WHERE event_key IS NOT NULL DO NOTHING;

  -- Booking Cancelled Template
  INSERT INTO email_templates (business_id, event_key, name, subject, body, is_system_default, is_enabled, variables)
  VALUES (
    p_business_id,
    'booking_cancelled',
    'Booking Cancelled',
    'Booking Cancellation Confirmation',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef2f2; padding: 30px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
    <h1 style="color: #991b1b; margin: 0 0 10px 0; font-size: 28px;">Booking Cancelled</h1>
    <p style="color: #7f1d1d; margin: 0; font-size: 16px;">Your booking has been cancelled.</p>
  </div>

  <div style="background-color: #ffffff; padding: 25px; border: 1px solid #e7e5e4; border-radius: 8px; margin-bottom: 20px;">
    <p style="margin: 0 0 20px 0; color: #1c1917;">Hi {{customer_name}},</p>
    <p style="margin: 0 0 20px 0; color: #57534e;">This is to confirm that your booking has been cancelled.</p>

    <div style="background-color: #fafaf9; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
      <p style="margin: 0 0 8px 0; color: #57534e;"><strong>Service:</strong> {{service_name}}</p>
      <p style="margin: 0 0 8px 0; color: #57534e;"><strong>Date:</strong> {{booking_date}}</p>
      <p style="margin: 0; color: #57534e;"><strong>Time:</strong> {{booking_time}}</p>
    </div>

    <p style="margin: 0; color: #57534e;">If you have any questions or would like to rebook, please contact us at {{business_phone}}.</p>
  </div>

  <div style="text-align: center; margin-top: 30px;">
    <a href="{{rebook_link}}" style="display: inline-block; background-color: #1c1917; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 500;">Book Again</a>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center; color: #78716c; font-size: 14px;">
    <p style="margin: 0;">{{business_name}}</p>
    <p style="margin: 5px 0 0 0;">{{business_phone}}</p>
  </div>
</body>
</html>',
    true,
    true,
    '["customer_name", "service_name", "booking_date", "booking_time", "cancellation_reason", "cancelled_by", "business_name", "business_phone", "rebook_link"]'::jsonb
  )
  ON CONFLICT (business_id, event_key) WHERE event_key IS NOT NULL DO NOTHING;

  -- Gift Card Received Template
  INSERT INTO email_templates (business_id, event_key, name, subject, body, is_system_default, is_enabled, variables)
  VALUES (
    p_business_id,
    'gift_card_received',
    'Gift Card Received',
    'You''ve Received a Gift Card!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f0fdf4; padding: 30px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #16a34a;">
    <h1 style="color: #166534; margin: 0 0 10px 0; font-size: 28px;">🎁 Gift Card Received!</h1>
    <p style="color: #15803d; margin: 0; font-size: 16px;">Someone special sent you a gift.</p>
  </div>

  <div style="background-color: #ffffff; padding: 25px; border: 1px solid #e7e5e4; border-radius: 8px; margin-bottom: 20px;">
    <p style="margin: 0 0 20px 0; color: #1c1917;">Hello!</p>
    <p style="margin: 0 0 20px 0; color: #57534e;">{{sender_name}} has sent you a gift card for {{business_name}}!</p>

    <div style="background-color: #16a34a; color: white; padding: 25px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; opacity: 0.9;">Gift Card Code</p>
      <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 2px; font-family: monospace;">{{gift_card_code}}</p>
      <p style="margin: 15px 0 0 0; font-size: 18px; font-weight: 500;">{{amount}}</p>
    </div>

    <div style="background-color: #fafaf9; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #57534e; font-style: italic;">"{{message}}"</p>
    </div>

    <p style="margin: 0; color: #57534e; font-size: 14px;">Use this code at checkout to redeem your gift card. Save this email for your records.</p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center; color: #78716c; font-size: 14px;">
    <p style="margin: 0 0 5px 0;">{{business_name}}</p>
    <p style="margin: 0;">Enjoy your gift!</p>
  </div>
</body>
</html>',
    true,
    true,
    '["recipient_email", "gift_card_code", "amount", "message", "sender_name", "business_name"]'::jsonb
  )
  ON CONFLICT (business_id, event_key) WHERE event_key IS NOT NULL DO NOTHING;

  -- Gift Card Purchased Template
  INSERT INTO email_templates (business_id, event_key, name, subject, body, is_system_default, is_enabled, variables)
  VALUES (
    p_business_id,
    'gift_card_purchased',
    'Gift Card Purchase Receipt',
    'Gift Card Purchase Confirmation',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #1c1917; margin: 0 0 10px 0; font-size: 28px;">Gift Card Purchase Confirmation</h1>
    <p style="color: #57534e; margin: 0; font-size: 16px;">Thank you for your purchase!</p>
  </div>

  <div style="background-color: #ffffff; padding: 25px; border: 1px solid #e7e5e4; border-radius: 8px; margin-bottom: 20px;">
    <p style="margin: 0 0 20px 0; color: #1c1917;">Hi {{customer_name}},</p>
    <p style="margin: 0 0 20px 0; color: #57534e;">Thank you for purchasing a gift card from {{business_name}}.</p>

    <div style="background-color: #fafaf9; padding: 20px; border-radius: 4px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #57534e;">Gift Card Code:</td>
          <td style="padding: 8px 0; color: #1c1917; text-align: right; font-family: monospace; font-weight: bold;">{{gift_card_code}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #57534e;">Amount:</td>
          <td style="padding: 8px 0; color: #1c1917; text-align: right; font-weight: bold;">{{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #57534e;">Recipient:</td>
          <td style="padding: 8px 0; color: #1c1917; text-align: right;">{{recipient_email}}</td>
        </tr>
      </table>
    </div>

    <p style="margin: 0; color: #57534e; font-size: 14px;">The gift card has been sent to the recipient. They will receive a separate email with instructions on how to use it.</p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center; color: #78716c; font-size: 14px;">
    <p style="margin: 0 0 5px 0;">{{business_name}}</p>
    <p style="margin: 0;">Thank you for spreading joy!</p>
  </div>
</body>
</html>',
    true,
    true,
    '["customer_name", "customer_email", "gift_card_code", "amount", "recipient_email", "message", "business_name"]'::jsonb
  )
  ON CONFLICT (business_id, event_key) WHERE event_key IS NOT NULL DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create default templates for all existing businesses
DO $$
DECLARE
  business_record RECORD;
BEGIN
  FOR business_record IN SELECT id FROM businesses
  LOOP
    PERFORM create_default_transactional_templates(business_record.id);
  END LOOP;
END $$;