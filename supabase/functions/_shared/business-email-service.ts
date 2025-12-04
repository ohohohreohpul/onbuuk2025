import { Resend } from "npm:resend@3.0.0";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface BusinessEmailEvent {
  event_key: string;
  event_name: string;
  event_description: string;
  default_enabled: boolean;
  category: string;
  available_variables: string[];
  trigger_type: string;
}

export interface BusinessEmailTemplate {
  id: string;
  business_id: string;
  event_key: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  is_active: boolean;
}

export interface BusinessEmailSettings {
  business_id: string;
  emails_enabled: boolean;
  from_name: string | null;
  from_email: string | null;
  reply_to_email: string | null;
  email_signature: string | null;
  send_booking_confirmations: boolean;
  send_booking_reminders: boolean;
  send_booking_cancellations: boolean;
  send_thank_you_emails: boolean;
  reminder_hours_before: number;
  provider: string;
  provider_configured: boolean;
  api_key: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_secure: boolean;
}

export interface SendBusinessEmailRequest {
  business_id: string;
  event_key: string;
  recipient_email: string;
  recipient_name?: string;
  variables: Record<string, any>;
  booking_id?: string;
  customer_id?: string;
}

interface EmailData {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
}

export async function getBusinessSettings(businessId: string): Promise<BusinessEmailSettings | null> {
  const { data, error } = await supabase
    .from('business_email_settings')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load business email settings:', error);
    return null;
  }

  return data as BusinessEmailSettings | null;
}

export async function getBusinessTemplate(
  businessId: string,
  eventKey: string
): Promise<BusinessEmailTemplate | null> {
  const { data, error } = await supabase
    .from('business_email_templates')
    .select('*')
    .eq('business_id', businessId)
    .eq('event_key', eventKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Failed to load business template:', error);
    return null;
  }

  return data as BusinessEmailTemplate | null;
}

export async function getBusiness(businessId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('name, email, address, phone')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load business:', error);
    return null;
  }

  return data;
}

export function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(placeholder, String(value || ''));
  }

  return rendered;
}

export function validateVariables(
  required: string[],
  provided: Record<string, any>
): { valid: boolean; missing: string[] } {
  const missing = required.filter(key => !(key in provided) || provided[key] === undefined);
  return {
    valid: missing.length === 0,
    missing,
  };
}

async function sendViaResend(
  settings: BusinessEmailSettings,
  emailData: EmailData
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  if (!settings.api_key) {
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    const resend = new Resend(settings.api_key);

    const { data, error } = await resend.emails.send({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      reply_to: emailData.reply_to,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error('Resend exception:', err);
    return { success: false, error: err.message || 'Resend failed' };
  }
}

async function sendViaSendGrid(
  settings: BusinessEmailSettings,
  emailData: EmailData
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  if (!settings.api_key) {
    return { success: false, error: 'SendGrid API key not configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: emailData.to }],
        }],
        from: {
          email: emailData.from.match(/<(.+)>/)?.[1] || emailData.from,
          name: emailData.from.match(/(.+)</)?.  [1]?.trim() || undefined,
        },
        subject: emailData.subject,
        content: [
          {
            type: 'text/html',
            value: emailData.html,
          },
          ...(emailData.text ? [{
            type: 'text/plain',
            value: emailData.text,
          }] : []),
        ],
        reply_to: emailData.reply_to ? {
          email: emailData.reply_to,
        } : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.errors?.[0]?.message || 'SendGrid API error' };
    }

    const messageId = response.headers.get('x-message-id');
    return { success: true, emailId: messageId || undefined };
  } catch (err) {
    console.error('SendGrid exception:', err);
    return { success: false, error: err.message || 'SendGrid failed' };
  }
}

async function sendViaMailgun(
  settings: BusinessEmailSettings,
  emailData: EmailData
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  if (!settings.api_key || !settings.smtp_host) {
    return { success: false, error: 'Mailgun API key or domain not configured' };
  }

  try {
    const domain = settings.smtp_host;
    const formData = new FormData();
    formData.append('from', emailData.from);
    formData.append('to', emailData.to);
    formData.append('subject', emailData.subject);
    formData.append('html', emailData.html);
    if (emailData.text) formData.append('text', emailData.text);
    if (emailData.reply_to) formData.append('h:Reply-To', emailData.reply_to);

    const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${settings.api_key}`)}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.message || 'Mailgun API error' };
    }

    const result = await response.json();
    return { success: true, emailId: result.id };
  } catch (err) {
    console.error('Mailgun exception:', err);
    return { success: false, error: err.message || 'Mailgun failed' };
  }
}

async function sendViaPostmark(
  settings: BusinessEmailSettings,
  emailData: EmailData
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  if (!settings.api_key) {
    return { success: false, error: 'Postmark API key not configured' };
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': settings.api_key,
      },
      body: JSON.stringify({
        From: emailData.from,
        To: emailData.to,
        Subject: emailData.subject,
        HtmlBody: emailData.html,
        TextBody: emailData.text,
        ReplyTo: emailData.reply_to,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.Message || 'Postmark API error' };
    }

    const result = await response.json();
    return { success: true, emailId: result.MessageID };
  } catch (err) {
    console.error('Postmark exception:', err);
    return { success: false, error: err.message || 'Postmark failed' };
  }
}

async function sendViaBrevo(
  settings: BusinessEmailSettings,
  emailData: EmailData
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  if (!settings.api_key) {
    return { success: false, error: 'Brevo API key not configured' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': settings.api_key,
      },
      body: JSON.stringify({
        sender: {
          email: emailData.from.match(/<(.+)>/)?.[1] || emailData.from,
          name: emailData.from.match(/(.+)</)?.  [1]?.trim() || undefined,
        },
        to: [{
          email: emailData.to,
        }],
        subject: emailData.subject,
        htmlContent: emailData.html,
        textContent: emailData.text,
        replyTo: emailData.reply_to ? {
          email: emailData.reply_to,
        } : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.message || 'Brevo API error' };
    }

    const result = await response.json();
    return { success: true, emailId: result.messageId };
  } catch (err) {
    console.error('Brevo exception:', err);
    return { success: false, error: err.message || 'Brevo failed' };
  }
}

async function sendViaSMTP(
  settings: BusinessEmailSettings,
  emailData: EmailData
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  return {
    success: false,
    error: 'SMTP support requires additional configuration. Please use an API-based provider.',
  };
}

export async function sendBusinessEmail(
  businessId: string,
  template: BusinessEmailTemplate,
  recipientEmail: string,
  variables: Record<string, any>,
  settings: BusinessEmailSettings
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  if (!settings.provider_configured || settings.provider === 'not_configured') {
    return {
      success: false,
      error: 'Email provider not configured. Please configure your email provider in settings.',
    };
  }

  const business = await getBusiness(businessId);
  if (!business) {
    return { success: false, error: 'Business not found' };
  }

  const fromName = settings.from_name || business.name;
  const fromEmail = settings.from_email || business.email;
  const replyTo = settings.reply_to_email || business.email;

  const subject = renderTemplate(template.subject, variables);
  const htmlBody = renderTemplate(template.html_body, variables);
  const textBody = template.text_body ? renderTemplate(template.text_body, variables) : undefined;

  const emailData: EmailData = {
    from: `${fromName} <${fromEmail}>`,
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: textBody,
    reply_to: replyTo,
  };

  switch (settings.provider) {
    case 'resend':
      return await sendViaResend(settings, emailData);
    case 'sendgrid':
      return await sendViaSendGrid(settings, emailData);
    case 'mailgun':
      return await sendViaMailgun(settings, emailData);
    case 'postmark':
      return await sendViaPostmark(settings, emailData);
    case 'brevo':
      return await sendViaBrevo(settings, emailData);
    case 'smtp':
      return await sendViaSMTP(settings, emailData);
    default:
      return { success: false, error: `Unsupported provider: ${settings.provider}` };
  }
}

export async function logBusinessEmail(params: {
  business_id: string;
  event_key: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  status: 'sent' | 'failed' | 'queued' | 'pending';
  booking_id?: string;
  customer_id?: string;
  metadata?: Record<string, any>;
  provider_response?: Record<string, any>;
  provider_email_id?: string;
  error_message?: string;
}): Promise<void> {
  const { error } = await supabase.from('business_email_logs').insert({
    business_id: params.business_id,
    event_key: params.event_key,
    recipient_email: params.recipient_email,
    recipient_name: params.recipient_name || null,
    subject: params.subject,
    status: params.status,
    booking_id: params.booking_id || null,
    customer_id: params.customer_id || null,
    metadata: params.metadata || {},
    provider_response: params.provider_response || null,
    provider_email_id: params.provider_email_id || null,
    error_message: params.error_message || null,
  });

  if (error) {
    console.error('Failed to log business email:', error);
  }
}

export async function isEventEnabled(
  businessId: string,
  eventKey: string
): Promise<boolean> {
  const settings = await getBusinessSettings(businessId);
  if (!settings || !settings.emails_enabled || !settings.provider_configured) {
    return false;
  }

  switch (eventKey) {
    case 'booking_confirmation':
      return settings.send_booking_confirmations;
    case 'booking_reminder':
      return settings.send_booking_reminders;
    case 'booking_cancelled':
      return settings.send_booking_cancellations;
    case 'booking_thank_you':
      return settings.send_thank_you_emails;
    default:
      return true;
  }
}

export async function processSendBusinessEmail(
  request: SendBusinessEmailRequest
): Promise<{
  success: boolean;
  message: string;
  emailId?: string;
}> {
  const { business_id, event_key, recipient_email, recipient_name, variables, booking_id, customer_id } = request;

  const enabled = await isEventEnabled(business_id, event_key);
  if (!enabled) {
    return { success: false, message: `Email event ${event_key} is disabled or provider not configured` };
  }

  const settings = await getBusinessSettings(business_id);
  if (!settings) {
    return { success: false, message: 'Business email settings not found' };
  }

  if (!settings.provider_configured || settings.provider === 'not_configured') {
    return { success: false, message: 'Email provider not configured. Please configure in business settings.' };
  }

  const template = await getBusinessTemplate(business_id, event_key);
  if (!template) {
    return { success: false, message: `No template found for event ${event_key}` };
  }

  const subject = renderTemplate(template.subject, variables);

  const result = await sendBusinessEmail(business_id, template, recipient_email, variables, settings);

  await logBusinessEmail({
    business_id,
    event_key,
    recipient_email,
    recipient_name,
    subject,
    status: result.success ? 'sent' : 'failed',
    booking_id,
    customer_id,
    metadata: variables,
    provider_email_id: result.emailId,
    error_message: result.error,
  });

  if (!result.success) {
    return { success: false, message: result.error || 'Failed to send email' };
  }

  return {
    success: true,
    message: 'Email sent successfully',
    emailId: result.emailId,
  };
}

export async function testEmailConnection(
  settings: BusinessEmailSettings,
  testEmail: string
): Promise<{ success: boolean; error?: string }> {
  const emailData: EmailData = {
    from: `${settings.from_name || 'Test'} <${settings.from_email || 'test@example.com'}>`,
    to: testEmail,
    subject: 'Test Email Connection',
    html: '<h1>Success!</h1><p>Your email provider is configured correctly.</p>',
    text: 'Success! Your email provider is configured correctly.',
    reply_to: settings.reply_to_email || undefined,
  };

  switch (settings.provider) {
    case 'resend':
      return await sendViaResend(settings, emailData);
    case 'sendgrid':
      return await sendViaSendGrid(settings, emailData);
    case 'mailgun':
      return await sendViaMailgun(settings, emailData);
    case 'postmark':
      return await sendViaPostmark(settings, emailData);
    case 'brevo':
      return await sendViaBrevo(settings, emailData);
    case 'smtp':
      return await sendViaSMTP(settings, emailData);
    default:
      return { success: false, error: `Unsupported provider: ${settings.provider}` };
  }
}
