import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyAccountRequest {
  businessId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { businessId }: VerifyAccountRequest = await req.json();

    if (!businessId) {
      throw new Error("businessId is required");
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError || !business) {
      throw new Error("Business not found");
    }

    if (!business.stripe_connect_account_id) {
      throw new Error("No Stripe Connect account found for this business");
    }

    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("business_id", businessId)
      .eq("key", "stripe_secret_key")
      .maybeSingle();

    let stripeSecretKey = "";
    if (settings?.value) {
      try {
        stripeSecretKey = JSON.parse(settings.value);
      } catch {
        stripeSecretKey = settings.value;
      }
    }

    if (!stripeSecretKey || stripeSecretKey === "") {
      const platformKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (platformKey) {
        stripeSecretKey = platformKey;
      } else {
        throw new Error("Stripe secret key not configured");
      }
    }

    const accountResponse = await fetch(
      `https://api.stripe.com/v1/accounts/${business.stripe_connect_account_id}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
        },
      }
    );

    if (!accountResponse.ok) {
      const errorData = await accountResponse.text();
      throw new Error(`Failed to fetch Stripe account: ${errorData}`);
    }

    const account = await accountResponse.json();

    const updateData: Record<string, unknown> = {
      stripe_connect_charges_enabled: account.charges_enabled || false,
      stripe_connect_payouts_enabled: account.payouts_enabled || false,
      stripe_connect_details_submitted: account.details_submitted || false,
      stripe_connect_onboarding_complete: account.details_submitted && account.charges_enabled,
    };

    const { error: updateError } = await supabase
      .from("businesses")
      .update(updateData)
      .eq("id", businessId);

    if (updateError) {
      console.error("Failed to update business with Connect status:", updateError);
      throw new Error("Failed to update business status");
    }

    return new Response(
      JSON.stringify({
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        onboardingComplete: account.details_submitted && account.charges_enabled,
        country: account.country,
        email: account.email,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error verifying Connect account:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to verify Connect account" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});