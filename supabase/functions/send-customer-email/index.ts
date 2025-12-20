import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  businessId: string;
  toEmail: string;
  subject: string;
  body: string;
  customerId?: string;
}

interface EmailSettings {
  provider: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  api_key?: string;
  from_email: string;
  from_name: string;
}

async function sendWithResend(settings: EmailSettings, toEmail: string, subject: string, body: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${settings.from_name} <${settings.from_email}>`,
      to: [toEmail],
      subject: subject,
      html: body,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

async function sendWithSMTP(settings: EmailSettings, toEmail: string, subject: string, body: string) {
  // For SMTP, we would need a SMTP library
  // This is a placeholder - SMTP is complex in edge functions
  throw new Error('SMTP provider is not yet implemented. Please use Resend, SendGrid, or Mailgun.');
}

async function sendWithSendGrid(settings: EmailSettings, toEmail: string, subject: string, body: string) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: settings.from_email, name: settings.from_name },
      subject: subject,
      content: [{ type: 'text/html', value: body }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${error}`);
  }

  return { success: true };
}

async function sendWithMailgun(settings: EmailSettings, toEmail: string, subject: string, body: string) {
  // Mailgun requires a domain - we'll assume it's in the api_key as "domain:apikey"
  const [domain, apiKey] = settings.api_key?.split(':') || [];
  
  if (!domain || !apiKey) {
    throw new Error('Mailgun API key must be in format "domain:apikey"');
  }

  const formData = new FormData();
  formData.append('from', `${settings.from_name} <${settings.from_email}>`);
  formData.append('to', toEmail);
  formData.append('subject', subject);
  formData.append('html', body);

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`api:${apiKey}`),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mailgun API error: ${error}`);
  }

  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { businessId, toEmail, subject, body, customerId }: EmailRequest = await req.json();

    if (!businessId || !toEmail || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch email settings for the business
    const { data: settings, error: settingsError } = await supabase
      .from('email_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: 'Email settings not configured for this business' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let emailResult;
    let errorMessage = null;
    let status = 'sent';

    try {
      // Send email based on provider
      switch (settings.provider) {
        case 'resend':
          emailResult = await sendWithResend(settings, toEmail, subject, body);
          break;
        case 'sendgrid':
          emailResult = await sendWithSendGrid(settings, toEmail, subject, body);
          break;
        case 'mailgun':
          emailResult = await sendWithMailgun(settings, toEmail, subject, body);
          break;
        case 'smtp':
          emailResult = await sendWithSMTP(settings, toEmail, subject, body);
          break;
        default:
          throw new Error(`Unsupported email provider: ${settings.provider}`);
      }
    } catch (error) {
      status = 'failed';
      errorMessage = error.message;
    }

    // Log the email attempt
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        business_id: businessId,
        customer_id: customerId || null,
        to_email: toEmail,
        from_email: settings.from_email,
        subject: subject,
        body: body,
        status: status,
        error_message: errorMessage,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      });

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    if (status === 'failed') {
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result: emailResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});