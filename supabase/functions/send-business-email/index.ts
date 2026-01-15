import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BusinessEmailRequest {
  business_id: string;
  event_key: string;
  recipient_email: string;
  recipient_name: string;
  variables: { [key: string]: string };
  booking_id?: string;
}

interface GiftCardVisualData {
  code: string;
  amount: string;
  businessName: string;
  message: string | null;
  senderName: string | null;
}

function generateGiftCardVisual(data: GiftCardVisualData): string {
  const messageSection = data.message 
    ? `<tr>
        <td style="padding: 15px 30px;">
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-style: italic; color: #856404;">"${data.message}"</p>
            ${data.senderName ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">- ${data.senderName}</p>` : ''}
          </div>
        </td>
      </tr>`
    : '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; font-family: Arial, sans-serif;">
      <tr>
        <td align="center">
          <table width="500" cellpadding="0" cellspacing="0" style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                <h2 style="margin: 0; color: white; font-size: 24px;">🎁 Your Gift Card</h2>
                <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${data.businessName}</p>
              </td>
            </tr>
            
            <!-- Amount -->
            <tr>
              <td style="padding: 30px; text-align: center;">
                <div style="font-size: 48px; font-weight: bold; color: #333;">${data.amount}</div>
              </td>
            </tr>
            
            ${messageSection}
            
            <!-- Code Box -->
            <tr>
              <td style="padding: 0 30px 30px 30px;">
                <div style="background: #f8f9fa; border: 2px dashed #ddd; border-radius: 12px; padding: 20px; text-align: center;">
                  <div style="font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Gift Card Code</div>
                  <div style="font-size: 22px; font-weight: bold; color: #333; letter-spacing: 3px; margin-top: 8px; font-family: 'Courier New', monospace;">${data.code}</div>
                </div>
              </td>
            </tr>
            
            <!-- Instructions -->
            <tr>
              <td style="padding: 0 30px 30px 30px;">
                <div style="background: #e8f5e9; border-radius: 8px; padding: 20px;">
                  <h3 style="margin: 0 0 12px 0; color: #2e7d32; font-size: 14px;">How to Redeem</h3>
                  <ol style="margin: 0; padding-left: 20px; color: #555; font-size: 13px; line-height: 1.8;">
                    <li>Visit ${data.businessName}'s booking page</li>
                    <li>Select your desired service</li>
                    <li>Enter your gift card code at checkout</li>
                    <li>Enjoy!</li>
                  </ol>
                </div>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="padding: 20px 30px; border-top: 1px solid #eee; text-align: center;">
                <p style="margin: 0; color: #999; font-size: 11px;">
                  This gift card is redeemable only at ${data.businessName}.<br>
                  Please save this email - it contains your unique gift card code.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
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

    const { business_id, event_key, recipient_email, recipient_name, variables, booking_id }: BusinessEmailRequest = await req.json();

    console.log(`📧 Sending ${event_key} email to ${recipient_email} for business ${business_id}`);

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
    let body = replaceVariables(template.body, variables);

    // For gift card emails, append a beautiful gift card visual
    if (event_key === 'gift_card_received' || event_key === 'gift_card_purchased') {
      const giftCardVisual = generateGiftCardVisual({
        code: variables.gift_card_code || '',
        amount: variables.amount || '',
        businessName: variables.business_name || '',
        message: variables.message || null,
        senderName: variables.sender_name || null,
      });
      body = body + giftCardVisual;
    }

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