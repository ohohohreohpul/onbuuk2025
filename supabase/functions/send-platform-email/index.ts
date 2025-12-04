import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { processSendEmail, type SendEmailRequest } from "../_shared/platform-email-service.ts";

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
    const request: SendEmailRequest = await req.json();

    if (!request.event_key || !request.recipient_email || !request.variables) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: event_key, recipient_email, variables',
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

    console.log(`📧 Processing email for event: ${request.event_key}`);
    console.log(`   To: ${request.recipient_email}`);

    const result = await processSendEmail(request);

    if (!result.success) {
      console.error(`❌ Failed to send email: ${result.message}`);
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

    console.log(`✅ Email sent successfully (ID: ${result.emailId})`);

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
    console.error('Error processing email request:', error);

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
