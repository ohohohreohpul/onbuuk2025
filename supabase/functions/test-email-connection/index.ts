import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { testEmailConnection, type BusinessEmailSettings } from "../_shared/business-email-service.ts";

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
    const { settings, testEmail } = await req.json();

    if (!settings || !testEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: settings, testEmail',
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

    console.log(`🧪 Testing email connection for provider: ${settings.provider}`);
    console.log(`   Test email: ${testEmail}`);

    const result = await testEmailConnection(settings as BusinessEmailSettings, testEmail);

    if (!result.success) {
      console.error(`❌ Test failed: ${result.error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
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

    console.log(`✅ Test email sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test email sent successfully',
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
    console.error('Error testing email connection:', error);

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