import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TestEmailRequest {
  businessId: string;
  testEmail: string;
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

async function sendWithResend(settings: EmailSettings, toEmail: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${settings.from_name} <${settings.from_email}>`,
      to: [toEmail],
      subject: 'Test Email from Buuk',
      html: `<h1>Email Configuration Test</h1><p>This is a test email from your Buuk booking system. If you received this, your email settings are working correctly!</p><p><strong>From:</strong> ${settings.from_name} &lt;${settings.from_email}&gt;</p>`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

async function sendWithSendGrid(settings: EmailSettings, toEmail: string) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: settings.from_email, name: settings.from_name },
      subject: 'Test Email from Buuk',
      content: [{ 
        type: 'text/html', 
        value: `<h1>Email Configuration Test</h1><p>This is a test email from your Buuk booking system. If you received this, your email settings are working correctly!</p><p><strong>From:</strong> ${settings.from_name} &lt;${settings.from_email}&gt;</p>` 
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SendGrid API error: ${error}`);
  }

  return { success: true };
}

async function sendWithMailgun(settings: EmailSettings, toEmail: string) {
  const [domain, apiKey] = settings.api_key?.split(':') || [];
  
  if (!domain || !apiKey) {
    throw new Error('Mailgun API key must be in format "domain:apikey"');
  }

  const formData = new FormData();
  formData.append('from', `${settings.from_name} <${settings.from_email}>`);
  formData.append('to', toEmail);
  formData.append('subject', 'Test Email from Buuk');
  formData.append('html', `<h1>Email Configuration Test</h1><p>This is a test email from your Buuk booking system. If you received this, your email settings are working correctly!</p><p><strong>From:</strong> ${settings.from_name} &lt;${settings.from_email}&gt;</p>`);

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

    const { businessId, testEmail }: TestEmailRequest = await req.json();

    if (!businessId || !testEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing businessId or testEmail' }),
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

    // Send test email based on provider
    let result;
    switch (settings.provider) {
      case 'resend':
        result = await sendWithResend(settings, testEmail);
        break;
      case 'sendgrid':
        result = await sendWithSendGrid(settings, testEmail);
        break;
      case 'mailgun':
        result = await sendWithMailgun(settings, testEmail);
        break;
      case 'smtp':
        throw new Error('SMTP provider is not yet implemented. Please use Resend, SendGrid, or Mailgun.');
      default:
        throw new Error(`Unsupported email provider: ${settings.provider}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Test email sent successfully!', result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error testing email connection:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});