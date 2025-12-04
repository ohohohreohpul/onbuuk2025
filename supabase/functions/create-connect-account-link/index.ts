import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConnectAccountRequest {
  businessId: string;
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { businessId, country, accountType = "standard" }: ConnectAccountRequest = await req.json();

    if (!businessId || !country) {
      throw new Error("businessId and country are required");
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError || !business) {
      throw new Error("Business not found");
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

    const origin = req.headers.get("origin") || "";
    const refreshUrl = `${origin}/admin?connect_refresh=true`;
    const returnUrl = `${origin}/admin?connect_return=true`;

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