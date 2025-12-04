import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { processSendBusinessEmail, type SendBusinessEmailRequest } from "../_shared/business-email-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const request: SendBusinessEmailRequest = await req.json();

    if (!request.business_id || !request.event_key || !request.recipient_email || !request.variables) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: business_id, event_key, recipient_email, variables',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`📧 Processing business email for event: ${request.event_key}`);
    console.log(`   Business: ${request.business_id}`);
    console.log(`   To: ${request.recipient_email}`);

    const result = await processSendBusinessEmail(request);

    if (!result.success) {
      console.error(`❌ Failed to send business email: ${result.message}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log(`✅ Business email sent successfully (ID: ${result.emailId})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        emailId: result.emailId,
        recipient: request.recipient_email,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error processing business email request:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
