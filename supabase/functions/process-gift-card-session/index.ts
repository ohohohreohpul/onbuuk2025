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

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      console.error("Stripe secret key not configured");
      throw new Error("Stripe secret key not configured on server");
    }

    console.log("Retrieving Stripe session...");
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