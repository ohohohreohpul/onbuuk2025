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

interface ConnectAccountRequest {
  country: string;
  accountType?: string;
}

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
    const { country, accountType = "standard" }: ConnectAccountRequest = await req.json();

    if (!country) {
      throw new Error("country is required");
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError || !business) {
      throw new Error("Business not found");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured for the Zenno platform");
    }

    const requestOrigin = req.headers.get("origin") || "";
    const configuredOrigin = Deno.env.get("APP_URL") || requestOrigin;
    const appOrigin = new URL(configuredOrigin).origin;
    const refreshUrl = `${appOrigin}/admin?view=settings&tab=payment&connect_refresh=true`;
    const returnUrl = `${appOrigin}/admin?view=settings&tab=payment&connect_return=true`;

    let accountId = business.stripe_connect_account_id;

    if (!accountId) {
      const accountParams: Record<string, unknown> = {
        type: accountType,
        country: country.toUpperCase(),
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      };

      if (business.email) {
        accountParams.email = business.email;
      }

      const createAccountResponse = await fetch("https://api.stripe.com/v1/accounts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(accountParams as Record<string, string>),
      });

      if (!createAccountResponse.ok) {
        const errorData = await createAccountResponse.text();
        throw new Error(`Failed to create Stripe account: ${errorData}`);
      }

      const account = await createAccountResponse.json();
      accountId = account.id;

      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          stripe_connect_account_id: accountId,
          stripe_account_type: accountType,
          stripe_connect_country: country.toUpperCase(),
          stripe_connect_created_at: new Date().toISOString(),
        })
        .eq("id", businessId);

      if (updateError) {
        console.error("Failed to update business with Connect account ID:", updateError);
      }
    }

    const accountLinkParams = new URLSearchParams({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    const accountLinkResponse = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: accountLinkParams,
    });

    if (!accountLinkResponse.ok) {
      const errorData = await accountLinkResponse.text();
      throw new Error(`Failed to create account link: ${errorData}`);
    }

    const accountLink = await accountLinkResponse.json();

    return new Response(
      JSON.stringify({ 
        url: accountLink.url,
        accountId: accountId 
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

    console.error("Error creating Connect account link:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create Connect account link" }),
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
