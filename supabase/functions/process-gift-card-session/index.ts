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

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const { data: existingGiftCard } = await supabase
      .from("gift_cards")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existingGiftCard) {
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
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      throw new Error("Payment has not been completed");
    }

    const metadata = session.metadata;
    if (!metadata || metadata.type !== "gift_card_new") {
      throw new Error("Invalid session type");
    }

    if (!metadata.gc_code || !metadata.gc_amount || !metadata.business_id) {
      throw new Error("Missing required gift card data in session");
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

    const { data: newGiftCard, error: giftCardCreateError } = await supabase
      .from("gift_cards")
      .insert(giftCardInsert)
      .select()
      .single();

    if (giftCardCreateError) {
      console.error("Error creating gift card:", giftCardCreateError);
      throw new Error(`Failed to create gift card: ${giftCardCreateError.message}`);
    }

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