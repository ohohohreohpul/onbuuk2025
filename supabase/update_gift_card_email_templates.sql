-- Update gift card email templates with printable HTML gift card design
-- Run this in Supabase SQL Editor

-- Gift Card Purchased (sent to buyer)
UPDATE email_templates 
SET body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333; text-align: center;">Thank You for Your Purchase!</h1>
  
  <p>Dear {{customer_name}},</p>
  
  <p>Thank you for purchasing a gift card from <strong>{{business_name}}</strong>!</p>
  
  <!-- Printable Gift Card -->
  <div style="page-break-inside: avoid; border: 2px dashed #ccc; padding: 10px; margin: 30px 0;">
    <p style="text-align: center; color: #666; font-size: 12px; margin: 0 0 10px 0;">✂️ Print and cut along the dotted line ✂️</p>
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 40px 30px; text-align: center; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
      <div style="font-size: 12px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 5px;">🎁 GIFT CARD</div>
      <div style="font-size: 14px; margin-bottom: 20px;">{{business_name}}</div>
      
      <div style="font-size: 48px; font-weight: bold; margin: 20px 0;">{{amount}}</div>
      
      <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 15px; margin: 20px auto; max-width: 280px;">
        <div style="font-size: 11px; opacity: 0.8; margin-bottom: 5px;">GIFT CARD CODE</div>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; font-family: monospace;">{{gift_card_code}}</div>
      </div>
      
      <div style="font-size: 11px; opacity: 0.7; margin-top: 20px;">Redeemable at {{business_name}}</div>
    </div>
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
updated_at = NOW()
WHERE event_key = 'gift_card_purchased';

-- Gift Card Received (sent to recipient)
UPDATE email_templates 
SET body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333; text-align: center;">🎁 You''ve Received a Gift!</h1>
  
  <p>Great news! <strong>{{sender_name}}</strong> has sent you a gift card to use at <strong>{{business_name}}</strong>!</p>
  
  <!-- Printable Gift Card -->
  <div style="page-break-inside: avoid; border: 2px dashed #ccc; padding: 10px; margin: 30px 0;">
    <p style="text-align: center; color: #666; font-size: 12px; margin: 0 0 10px 0;">✂️ Print and cut along the dotted line ✂️</p>
    
    <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 16px; padding: 40px 30px; text-align: center; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
      <div style="font-size: 12px; letter-spacing: 2px; opacity: 0.9; margin-bottom: 5px;">🎁 GIFT CARD</div>
      <div style="font-size: 14px; margin-bottom: 20px;">{{business_name}}</div>
      
      <div style="font-size: 48px; font-weight: bold; margin: 20px 0;">{{amount}}</div>
      
      <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 15px; margin: 20px auto; max-width: 280px;">
        <div style="font-size: 11px; opacity: 0.8; margin-bottom: 5px;">YOUR GIFT CARD CODE</div>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; font-family: monospace;">{{gift_card_code}}</div>
      </div>
      
      <div style="font-size: 11px; opacity: 0.7; margin-top: 20px;">Redeemable at {{business_name}}</div>
    </div>
  </div>
  
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
updated_at = NOW()
WHERE event_key = 'gift_card_received';

-- Verify updates
SELECT event_key, name, updated_at FROM email_templates 
WHERE event_key IN ('gift_card_purchased', 'gift_card_received');
