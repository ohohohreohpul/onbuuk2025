import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckoutRequest {
  bookingId?: string;
  giftCardId?: string;
  customerEmail: string;
  customerName: string;
  amount: number;
  serviceName: string;
  specialistName: string;
  dateTime: string;
  isGiftCard?: boolean;
  businessId?: string;
  giftCardData?: {
    code: string;
    originalValueCents: number;
    purchasedForEmail: string | null;
    expiresAt: string | null;
    message: string | null;
  };
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

    const requestData: CheckoutRequest = await req.json();
    const { bookingId, giftCardId, customerEmail, customerName, amount, serviceName, specialistName, dateTime, isGiftCard, giftCardData } = requestData;
    let businessId = requestData.businessId;

    if (!businessId && bookingId) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("business_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (booking) {
        businessId = booking.business_id;
      }
    }

    if (!businessId && giftCardId) {
      const { data: giftCard } = await supabase
        .from("gift_cards")
        .select("business_id")
        .eq("id", giftCardId)
        .maybeSingle();

      if (giftCard) {
        businessId = giftCard.business_id;
      }
    }

    if (!businessId) {
      throw new Error("Could not determine business ID");
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_charges_enabled, platform_fee_percentage")
      .eq("id", businessId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("business_id", businessId)
      .in("key", ["stripe_enabled", "stripe_secret_key"]);

    const settingsMap: { [key: string]: string } = {};
    if (settings) {
      settings.forEach((setting: { key: string; value: string }) => {
        let value = setting.value;
        
        // Handle potential double-encoding or JSON-stringified values
        // First, try to parse as JSON to remove any quotes
        try {
          const parsed = JSON.parse(value);
          // If parsed successfully and it's a string, use it
          if (typeof parsed === 'string') {
            value = parsed;
          } else if (typeof parsed === 'boolean') {
            value = parsed.toString();
          }
        } catch {
          // Not JSON, use as-is but trim whitespace
          value = value.trim();
        }
        
        // Remove any remaining wrapper quotes (in case of double encoding)
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        settingsMap[setting.key] = value;
      });
    }

    let stripeSecretKey = settingsMap.stripe_secret_key || "";
    
    // Clean up the key - remove any whitespace and validate format
    stripeSecretKey = stripeSecretKey.trim();
    
    // Log key format for debugging (only first/last chars for security)
    if (stripeSecretKey) {
      const keyPreview = stripeSecretKey.length > 10 
        ? `${stripeSecretKey.substring(0, 7)}...${stripeSecretKey.substring(stripeSecretKey.length - 4)}`
        : "too_short";
      console.log(`Stripe key format check: ${keyPreview}, length: ${stripeSecretKey.length}`);
    }
    
    if (!stripeSecretKey || stripeSecretKey === "") {
      const platformKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (platformKey) {
        stripeSecretKey = platformKey;
        console.log("Using platform Stripe key");
      } else {
        throw new Error("Stripe secret key not configured");
      }
    }

    const origin = req.headers.get("origin") || "";

    let successUrl: string;
    let cancelUrl: string;
    let productName: string;
    let productDescription: string;
    const metadata: { [key: string]: string } = {
      "customer_name": customerName,
      "business_id": businessId,
    };

    const { data: businessData } = await supabase
      .from("businesses")
      .select("subdomain")
      .eq("id", businessId)
      .maybeSingle();

    const businessSubdomain = businessData?.subdomain || '';
    const cancelUrlParams = businessSubdomain ? `?from=${businessSubdomain}` : '';

    if (isGiftCard) {
      if (giftCardId) {
        // Legacy: existing gift card (already created)
        successUrl = `${origin}/gift-card-success?session_id={CHECKOUT_SESSION_ID}&gift_card_id=${giftCardId}`;
        cancelUrl = `${origin}/payment-cancelled${cancelUrlParams}`;
        productName = serviceName;
        productDescription = dateTime;
        metadata["gift_card_id"] = giftCardId;
        metadata["type"] = "gift_card";
      } else if (giftCardData) {
        // New flow: gift card data passed, will be created after payment
        successUrl = `${origin}/gift-card-success?session_id={CHECKOUT_SESSION_ID}&business_id=${businessId}`;
        cancelUrl = `${origin}/payment-cancelled${cancelUrlParams}`;
        productName = serviceName;
        productDescription = dateTime;
        metadata["type"] = "gift_card_new";
        metadata["gc_code"] = giftCardData.code;
        metadata["gc_amount"] = giftCardData.originalValueCents.toString();
        if (giftCardData.purchasedForEmail) {
          metadata["gc_recipient_email"] = giftCardData.purchasedForEmail;
        }
        if (giftCardData.expiresAt) {
          metadata["gc_expires_at"] = giftCardData.expiresAt;
        }
        if (giftCardData.message) {
          metadata["gc_message"] = giftCardData.message;
        }
      } else {
        throw new Error("Gift card requires either giftCardId or giftCardData");
      }
    } else if (bookingId) {
      successUrl = `${origin}/booking-success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`;
      cancelUrl = `${origin}/payment-cancelled${cancelUrlParams}`;
      productName = `${serviceName} with ${specialistName}`;
      productDescription = `Appointment on ${dateTime}`;
      metadata["booking_id"] = bookingId;
      metadata["type"] = "booking";
    } else {
      throw new Error("Either bookingId or giftCardId must be provided");
    }

    const amountInCents = Math.round(amount * 100);
    const stripeParams: { [key: string]: string } = {
      "mode": "payment",
      "success_url": successUrl,
      "cancel_url": cancelUrl,
      "customer_email": customerEmail,
      "allow_promotion_codes": "true",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][product_data][name]": productName,
      "line_items[0][price_data][product_data][description]": productDescription,
      "line_items[0][price_data][unit_amount]": amountInCents.toString(),
      "line_items[0][quantity]": "1",
    };

    if (
      business?.stripe_connect_account_id &&
      business?.stripe_connect_onboarding_complete &&
      business?.stripe_connect_charges_enabled
    ) {
      const platformFeePercentage = business.platform_fee_percentage || 2.5;
      const applicationFee = Math.round(amountInCents * (platformFeePercentage / 100));

      stripeParams["payment_intent_data[application_fee_amount]"] = applicationFee.toString();
      stripeParams["payment_intent_data[on_behalf_of]"] = business.stripe_connect_account_id;
      stripeParams["payment_intent_data[transfer_data][destination]"] = business.stripe_connect_account_id;
      
      metadata["connected_account_id"] = business.stripe_connect_account_id;
      metadata["platform_fee"] = applicationFee.toString();
      metadata["platform_fee_percentage"] = platformFeePercentage.toString();

      console.log(`Using Stripe Connect for business ${businessId}, account ${business.stripe_connect_account_id}, fee: ${platformFeePercentage}%`);
    } else {
      console.log(`Using legacy Stripe integration for business ${businessId}`);
    }

    Object.keys(metadata).forEach((key) => {
      stripeParams[`metadata[${key}]`] = metadata[key];
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(stripeParams),
    });

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.text();
      console.error("Stripe API error response:", errorData);
      
      // Parse and provide more helpful error messages
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.error?.message?.includes("Invalid API Key")) {
          throw new Error(
            "Invalid Stripe API key. Please check that your secret key is correct and doesn't have extra spaces or quotes. " +
            "Go to Payment Settings and re-enter your Stripe secret key."
          );
        }
        throw new Error(`Stripe error: ${errorJson.error?.message || errorData}`);
      } catch (parseError) {
        throw new Error(`Stripe API error: ${errorData}`);
      }
    }

    const session = await stripeResponse.json();

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create checkout session" }),
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