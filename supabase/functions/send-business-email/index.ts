import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Attachment {
  filename: string;
  content: string; // base64 encoded
  contentType: string;
}

interface BusinessEmailRequest {
  business_id: string;
  event_key: string;
  recipient_email: string;
  recipient_name: string;
  variables: { [key: string]: string };
  booking_id?: string;
  attachments?: Attachment[];
}

function replaceVariables(template: string, variables: { [key: string]: string }): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { business_id, event_key, recipient_email, recipient_name, variables, booking_id, attachments }: BusinessEmailRequest = await req.json();

    console.log(`📧 Sending ${event_key} email to ${recipient_email} for business ${business_id}`);
    console.log(`📎 Attachments received: ${attachments ? attachments.length : 0}`);

    if (!business_id || !event_key || !recipient_email || !variables) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: business_id, event_key, recipient_email, variables' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email settings exist for this business
    const { data: emailSettings, error: settingsError } = await supabase
      .from('email_settings')
      .select('id, is_verified')
      .eq('business_id', business_id)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching email settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch email settings', details: settingsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!emailSettings) {
      console.warn(`⚠️ No email settings configured for business ${business_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email settings not configured for this business. Please configure email settings in the admin panel.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the email template for this event
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('business_id', business_id)
      .eq('event_key', event_key)
      .eq('is_enabled', true)
      .maybeSingle();

    if (templateError) {
      console.error('Error fetching template:', templateError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch email template', details: templateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template) {
      console.warn(`⚠️ No template found for event_key: ${event_key} in business ${business_id}`);
      
      // Check if any template exists but is disabled
      const { data: disabledTemplate } = await supabase
        .from('email_templates')
        .select('id, name, is_enabled')
        .eq('business_id', business_id)
        .eq('event_key', event_key)
        .maybeSingle();
      
      let errorMessage = `Email template "${event_key}" not found for this business.`;
      if (disabledTemplate && !disabledTemplate.is_enabled) {
        errorMessage = `Email template "${event_key}" exists but is disabled. Please enable it in Email Settings.`;
      } else {
        errorMessage = `Email template "${event_key}" not found. Please create it in Email Settings > Templates.`;
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Found template: ${template.name || event_key}`);

    // Replace variables in subject and body
    const subject = replaceVariables(template.subject, variables);
    const body = replaceVariables(template.body, variables);

    // Find customer_id if booking_id is provided
    let customerId = null;
    if (booking_id) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('customer_email')
        .eq('id', booking_id)
        .maybeSingle();

      if (booking) {
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', business_id)
          .eq('email', booking.customer_email)
          .maybeSingle();

        if (customer) {
          customerId = customer.id;
        }
      }
    }

    // Call the send-customer-email function
    console.log(`📤 Calling send-customer-email...`);
    const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-customer-email', {
      body: {
        businessId: business_id,
        toEmail: recipient_email,
        subject: subject,
        body: body,
        customerId: customerId,
        attachments: attachments,
      },
    });

    if (emailError) {
      console.error('❌ Error sending email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!emailResult?.success) {
      console.error('❌ Email service returned error:', emailResult);
      return new Response(
        JSON.stringify({ error: 'Email service failed', details: emailResult?.error || 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Email sent successfully to ${recipient_email}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in send-business-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});