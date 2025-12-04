import { Resend } from "npm:resend@3.0.0";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface EmailEvent {
  event_key: string;
  event_name: string;
  event_description: string;
  enabled: boolean;
  category: string;
  available_variables: string[];
  trigger_type: string;
}

export interface EmailTemplate {
  id: string;
  event_key: string;
  template_name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  is_default: boolean;
  preview_data: Record<string, any>;
}

export interface EmailSettings {
  provider: string;
  api_key_configured: boolean;
  default_from_email: string;
  default_from_name: string;
  default_reply_to: string | null;
  daily_limit: number;
  rate_limit_per_minute: number;
}

export interface SendEmailRequest {
  event_key: string;
  recipient_email: string;
  variables: Record<string, any>;
  business_id?: string;
}

export async function getEventConfig(eventKey: string): Promise<EmailEvent | null> {
  const { data, error } = await supabase
    .from('platform_email_events')
    .select('*')
    .eq('event_key', eventKey)
    .single();

  if (error || !data) {
    console.error('Failed to load event config:', error);
    return null;
  }

  return data as EmailEvent;
}

export async function getTemplate(eventKey: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('platform_email_templates')
    .select('*')
    .eq('event_key', eventKey)
    .eq('is_default', true)
    .single();

  if (error || !data) {
    console.error('Failed to load template:', error);
    return null;
  }

  return data as EmailTemplate;
}

export async function getSettings(): Promise<EmailSettings | null> {
  const { data, error } = await supabase
    .from('platform_email_settings')
    .select('*')
    .limit(1)
    .single();

  if (error || !data) {
    console.error('Failed to load email settings:', error);
    return null;
  }

  return data as EmailSettings;
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

export async function sendEmail(
  template: EmailTemplate,
  recipientEmail: string,
  variables: Record<string, any>
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const resend = new Resend(resendApiKey);

  const subject = renderTemplate(template.subject, variables);
  const htmlBody = renderTemplate(template.html_body, variables);
  const textBody = template.text_body ? renderTemplate(template.text_body, variables) : undefined;

  try {
    const { data, error } = await resend.emails.send({
      from: `${template.from_name} <${template.from_email}>`,
      to: recipientEmail,
      subject: subject,
      html: htmlBody,
      text: textBody,
      reply_to: template.reply_to || undefined,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, emailId: data?.id };
  } catch (err) {
    console.error('Failed to send email:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

export async function logEmail(params: {
  event_key: string;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'failed' | 'queued' | 'pending';
  business_id?: string;
  metadata?: Record<string, any>;
  provider_response?: Record<string, any>;
  provider_email_id?: string;
  error_message?: string;
}): Promise<void> {
  const { error } = await supabase.from('platform_email_logs').insert({
    event_key: params.event_key,
    recipient_email: params.recipient_email,
    subject: params.subject,
    status: params.status,
    business_id: params.business_id || null,
    metadata: params.metadata || {},
    provider_response: params.provider_response || null,
    provider_email_id: params.provider_email_id || null,
    error_message: params.error_message || null,
  });

  if (error) {
    console.error('Failed to log email:', error);
  }
}

export async function isEventEnabled(eventKey: string): Promise<boolean> {
  const event = await getEventConfig(eventKey);
  return event?.enabled || false;
}

export async function processSendEmail(request: SendEmailRequest): Promise<{
  success: boolean;
  message: string;
  emailId?: string;
}> {
  const { event_key, recipient_email, variables, business_id } = request;

  const enabled = await isEventEnabled(event_key);
  if (!enabled) {
    return { success: false, message: `Event ${event_key} is disabled` };
  }

  const event = await getEventConfig(event_key);
  if (!event) {
    return { success: false, message: `Event ${event_key} not found` };
  }

  const validation = validateVariables(event.available_variables, variables);
  if (!validation.valid) {
    return {
      success: false,
      message: `Missing required variables: ${validation.missing.join(', ')}`,
    };
  }

  const template = await getTemplate(event_key);
  if (!template) {
    return { success: false, message: `No template found for event ${event_key}` };
  }

  const subject = renderTemplate(template.subject, variables);

  const result = await sendEmail(template, recipient_email, variables);

  await logEmail({
    event_key,
    recipient_email,
    subject,
    status: result.success ? 'sent' : 'failed',
    business_id,
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
