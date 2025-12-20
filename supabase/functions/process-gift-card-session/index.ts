import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { sessionId } = await req.json();

    console.log(`Processing gift card for session: ${sessionId}`);

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const { data: existingGiftCard } = await supabase
      .from("gift_cards")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existingGiftCard) {
      console.log(`Gift card already exists for session: ${sessionId}, ID: ${existingGiftCard.id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Gift card already exists",
          giftCardId: existingGiftCard.id
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // First, try to get the business_id from the session metadata if available
    // We need to use platform-level keys initially to retrieve basic session info
    let stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    let businessId: string | null = null;

    if (stripeSecret) {
      try {
        console.log("Attempting to retrieve session with platform keys to get business_id...");
        const platformStripe = new Stripe(stripeSecret);
        const platformSession = await platformStripe.checkout.sessions.retrieve(sessionId);
        businessId = platformSession.metadata?.business_id || null;
        console.log(`Got business_id from session metadata: ${businessId}`);
      } catch (error: any) {
        console.log("Platform-level session retrieval failed (expected if using business-specific keys):", error.message);
        // This is expected if the session was created with business-specific keys
        // We'll need to try a different approach
      }
    }

    // If we couldn't get business_id from platform keys, we need to infer it
    // In production, you might want to add the business_id to the URL params
    if (!businessId) {
      // Try to get from URL params if passed
      const url = new URL(req.url);
      businessId = url.searchParams.get("business_id");

      if (!businessId) {
        throw new Error("Could not determine business_id. Please include business_id in the request.");
      }
      console.log(`Using business_id from URL params: ${businessId}`);
    }

    // Now get the business-specific Stripe keys
    const { data: stripeSettings } = await supabase
      .from("site_settings")
      .select("value")
      .eq("business_id", businessId)
      .eq("key", "stripe_secret_key")
      .maybeSingle();

    if (!stripeSettings?.value) {
      console.log("No business-specific Stripe key found, trying platform key...");
      if (!stripeSecret) {
        throw new Error("Stripe secret key not configured");
      }
    } else {
      // Use business-specific key
      try {
        const parsed = JSON.parse(stripeSettings.value);
        stripeSecret = parsed;
        console.log("Using business-specific Stripe key");
      } catch {
        stripeSecret = stripeSettings.value;
        console.log("Using business-specific Stripe key (direct value)");
      }
    }

    console.log("Retrieving Stripe session with appropriate keys...");
    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log(`Stripe session retrieved. Payment status: ${session.payment_status}`);

    if (session.payment_status !== "paid") {
      throw new Error(`Payment has not been completed. Status: ${session.payment_status}`);
    }

    const metadata = session.metadata;
    console.log("Session metadata:", JSON.stringify(metadata, null, 2));

    if (!metadata || metadata.type !== "gift_card_new") {
      throw new Error(`Invalid session type. Expected: gift_card_new, Got: ${metadata?.type || 'none'}`);
    }

    if (!metadata.gc_code || !metadata.gc_amount || !metadata.business_id) {
      const missing = [];
      if (!metadata.gc_code) missing.push("gc_code");
      if (!metadata.gc_amount) missing.push("gc_amount");
      if (!metadata.business_id) missing.push("business_id");
      throw new Error(`Missing required gift card data: ${missing.join(", ")}`);
    }

    const giftCardInsert: any = {
      business_id: metadata.business_id,
      code: metadata.gc_code,
      original_value_cents: parseInt(metadata.gc_amount),
      current_balance_cents: parseInt(metadata.gc_amount),
      status: "active",
      stripe_session_id: sessionId,
      purchased_for_email: metadata.gc_recipient_email || null,
      expires_at: metadata.gc_expires_at || null,
    };

    console.log("Attempting to insert gift card:", JSON.stringify(giftCardInsert, null, 2));

    const { data: newGiftCard, error: giftCardCreateError } = await supabase
      .from("gift_cards")
      .insert(giftCardInsert)
      .select()
      .single();

    if (giftCardCreateError) {
      console.error("Error creating gift card - Full error:", JSON.stringify(giftCardCreateError, null, 2));
      throw new Error(`Database error: ${giftCardCreateError.message} (Code: ${giftCardCreateError.code || 'unknown'})`);
    }

    console.log(`Gift card created successfully with ID: ${newGiftCard.id}`);

    await supabase
      .from("gift_card_transactions")
      .insert({
        gift_card_id: newGiftCard.id,
        amount_cents: parseInt(metadata.gc_amount),
        transaction_type: "purchase",
        description: `Purchased by ${metadata.customer_name}`,
      });

    if (metadata.gc_recipient_email) {
      await supabase.functions.invoke("send-business-email", {
        body: {
          businessId: metadata.business_id,
          to: metadata.gc_recipient_email,
          templateType: "gift_card_received",
          data: {
            recipientEmail: metadata.gc_recipient_email,
            giftCardCode: metadata.gc_code,
            amount: (parseInt(metadata.gc_amount) / 100).toFixed(2),
            message: metadata.gc_message || "",
            senderName: metadata.customer_name,
          },
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Gift card created successfully",
        giftCardId: newGiftCard.id
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error processing gift card session:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process gift card session" }),
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