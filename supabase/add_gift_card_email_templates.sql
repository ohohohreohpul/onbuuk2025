-- Add default gift card email templates for all businesses with email settings
-- Run this in Supabase SQL Editor

-- Gift Card Purchased (sent to buyer)
INSERT INTO email_templates (business_id, event_key, name, subject, body, is_enabled, created_at, updated_at)
SELECT 
  es.business_id,
  'gift_card_purchased',
  'Gift Card Purchase Confirmation',
  'Your Gift Card Purchase - {{gift_card_code}}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333; text-align: center;">Thank You for Your Purchase!</h1>
    
    <p>Dear {{customer_name}},</p>
    
    <p>Thank you for purchasing a gift card from <strong>{{business_name}}</strong>!</p>
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; margin: 20px 0; text-align: center; color: white;">
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">GIFT CARD CODE</p>
      <p style="margin: 10px 0; font-size: 28px; font-weight: bold; letter-spacing: 3px;">{{gift_card_code}}</p>
      <p style="margin: 0; font-size: 24px;">{{amount}}</p>
    </div>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #333;">Purchase Details</h3>
      <p><strong>Amount:</strong> {{amount}}</p>
      <p><strong>Recipient:</strong> {{recipient_email}}</p>
      <p><strong>Your Email:</strong> {{customer_email}}</p>
    </div>
    
    <p>The recipient will receive a separate email with the gift card details.</p>
    
    <p style="color: #666; font-size: 14px;">If you have any questions, please don''t hesitate to contact us.</p>
    
    <p>Best regards,<br><strong>{{business_name}}</strong></p>
  </div>',
  true,
  NOW(),
  NOW()
FROM email_settings es
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates et 
  WHERE et.business_id = es.business_id 
  AND et.event_key = 'gift_card_purchased'
)
ON CONFLICT (business_id, event_key) DO NOTHING;

-- Gift Card Received (sent to recipient)
INSERT INTO email_templates (business_id, event_key, name, subject, body, is_enabled, created_at, updated_at)
SELECT 
  es.business_id,
  'gift_card_received',
  'You Received a Gift Card!',
  'You''ve Received a Gift Card from {{sender_name}}!',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1 style="color: #333; text-align: center;">🎁 You''ve Received a Gift!</h1>
    
    <p>Great news! <strong>{{sender_name}}</strong> has sent you a gift card to use at <strong>{{business_name}}</strong>!</p>
    
    <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 12px; padding: 30px; margin: 20px 0; text-align: center; color: white;">
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">YOUR GIFT CARD CODE</p>
      <p style="margin: 10px 0; font-size: 28px; font-weight: bold; letter-spacing: 3px;">{{gift_card_code}}</p>
      <p style="margin: 0; font-size: 24px;">{{amount}}</p>
    </div>
    
    {{#if message}}
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-style: italic;">"{{message}}"</p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">- {{sender_name}}</p>
    </div>
    {{/if}}
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #333;">How to Use Your Gift Card</h3>
      <ol style="color: #666;">
        <li>Visit our booking page or store</li>
        <li>Select your services or products</li>
        <li>Enter your gift card code at checkout</li>
        <li>Enjoy!</li>
      </ol>
    </div>
    
    <p style="color: #666; font-size: 14px;">This gift card can be used for any services or products at {{business_name}}.</p>
    
    <p>Enjoy your gift!<br><strong>{{business_name}}</strong></p>
  </div>',
  true,
  NOW(),
  NOW()
FROM email_settings es
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates et 
  WHERE et.business_id = es.business_id 
  AND et.event_key = 'gift_card_received'
)
ON CONFLICT (business_id, event_key) DO NOTHING;

-- Verify the templates were created
SELECT 
  b.name as business_name,
  et.event_key,
  et.name as template_name,
  et.is_enabled
FROM email_templates et
JOIN businesses b ON b.id = et.business_id
WHERE et.event_key IN ('gift_card_purchased', 'gift_card_received')
ORDER BY b.name, et.event_key;
