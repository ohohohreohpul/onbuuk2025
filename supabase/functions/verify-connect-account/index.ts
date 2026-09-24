import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authorizationErrorResponse,
  requireActiveAdmin,
} from "../_shared/adminAuthorization.ts";

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
    const { businessId, supabaseAdmin: supabase } = await requireActiveAdmin(req, {
      roles: ["owner"],
    });

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

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured for the Zenno platform");
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

    if (account.details_submitted && account.charges_enabled) {
      const { error: settingError } = await supabase.from("site_settings").upsert(
        {
          business_id: businessId,
          key: "stripe_enabled",
          value: "true",
          category: "payment",
        },
        { onConflict: "business_id,key" },
      );

      if (settingError) {
        console.error("Failed to enable Stripe payments:", settingError);
      }
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
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;

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
