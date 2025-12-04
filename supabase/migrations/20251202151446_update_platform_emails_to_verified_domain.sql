/*
  # Update Platform Email Addresses to Verified Domain

  1. Updates
    - Change all platform email addresses from `onboarding@resend.dev` to `noreply@noti.onbuuk.com`
    - Updates both `platform_email_settings` and `platform_email_templates` tables
  
  2. Changes
    - `platform_email_settings.default_from_email`: onboarding@resend.dev → noreply@noti.onbuuk.com
    - `platform_email_templates.from_email`: onboarding@resend.dev → noreply@noti.onbuuk.com
    - `platform_email_templates.from_name`: Buuk → Buuk Platform
  
  3. Notes
    - This uses the verified domain in Resend: noti.onbuuk.com
    - All platform emails will now send from this verified domain
*/

UPDATE platform_email_settings
SET 
  default_from_email = 'noreply@noti.onbuuk.com',
  default_from_name = 'Buuk Platform',
  updated_at = now()
WHERE default_from_email = 'onboarding@resend.dev';

UPDATE platform_email_templates
SET 
  from_email = 'noreply@noti.onbuuk.com',
  from_name = 'Buuk Platform',
  updated_at = now()
WHERE from_email = 'onboarding@resend.dev';