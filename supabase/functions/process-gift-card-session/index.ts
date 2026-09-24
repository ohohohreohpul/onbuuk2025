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
      throw new Error("Stripe is not configured for the Zenno platform");
    }

    console.log("Retrieving Stripe session with the Zenno platform key...");
    const stripe = new Stripe(stripeSecret);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const businessId = session.metadata?.business_id || null;

    if (!businessId) {
      throw new Error("The Stripe session is missing its business reference");
    }

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

    const cardType = metadata.gc_card_type === "service_pass" ? "service_pass" : "value";
    const purchasePriceCents = parseInt(metadata.gc_amount);

    if (!Number.isInteger(purchasePriceCents) || purchasePriceCents <= 0) {
      throw new Error("Invalid gift-card purchase amount");
    }

    if (session.amount_total !== null && session.amount_total !== purchasePriceCents) {
      throw new Error("Paid amount does not match the gift-card purchase");
    }

    if (cardType === "service_pass" && (
      !metadata.gc_service_pass_offer_id
      || !metadata.gc_service_pass_name
      || !metadata.gc_service_id
      || !metadata.gc_duration_id
      || !metadata.gc_visit_count
    )) {
      throw new Error("Missing required service-pass data");
    }

    const giftCardInsert: any = {
      business_id: metadata.business_id,
      code: metadata.gc_code,
      card_type: cardType,
      purchase_price_cents: purchasePriceCents,
      original_value_cents: cardType === "service_pass" ? 0 : purchasePriceCents,
      current_balance_cents: cardType === "service_pass" ? 0 : purchasePriceCents,
      service_pass_offer_id: cardType === "service_pass" ? metadata.gc_service_pass_offer_id : null,
      service_pass_name: cardType === "service_pass" ? metadata.gc_service_pass_name : null,
      service_id: cardType === "service_pass" ? metadata.gc_service_id : null,
      duration_id: cardType === "service_pass" ? metadata.gc_duration_id : null,
      original_visits: cardType === "service_pass" ? parseInt(metadata.gc_visit_count) : null,
      remaining_visits: cardType === "service_pass" ? parseInt(metadata.gc_visit_count) : null,
      status: "active",
      stripe_session_id: sessionId,
      purchased_for_email: metadata.gc_recipient_email || null,
      purchased_by_email: session.customer_details?.email || session.customer_email || null,
      purchased_by_name: metadata.customer_name || null,
      expires_at: metadata.gc_expires_at || null,
    };

    console.log("Attempting to insert gift card:", JSON.stringify(giftCardInsert, null, 2));

    const { data: newGiftCard, error: giftCardCreateError } = await supabase
      .from("gift_cards")
      .insert(giftCardInsert)
      .select()
      .single();

    let finalGiftCard = newGiftCard;

    if (giftCardCreateError) {
      if (giftCardCreateError.code === '23505') {
        console.log('Duplicate key error detected. Gift card likely created by webhook or another process.');
        console.log('Attempting to retrieve existing gift card...');

        const { data: existingCard, error: fetchError } = await supabase
          .from("gift_cards")
          .select("*")
          .or(`code.eq.${metadata.gc_code},stripe_session_id.eq.${sessionId}`)
          .maybeSingle();

        if (fetchError || !existingCard) {
          console.error("Failed to retrieve existing gift card after duplicate error");
          throw new Error(`Database error: ${giftCardCreateError.message} (Code: ${giftCardCreateError.code || 'unknown'})`);
        }

        console.log(`Found existing gift card with ID: ${existingCard.id}`);
        finalGiftCard = existingCard;
      } else {
        console.error("Error creating gift card - Full error:", JSON.stringify(giftCardCreateError, null, 2));
        throw new Error(`Database error: ${giftCardCreateError.message} (Code: ${giftCardCreateError.code || 'unknown'})`);
      }
    } else {
      console.log(`Gift card created successfully with ID: ${newGiftCard.id}`);
    }

    const { data: existingTransaction } = await supabase
      .from("gift_card_transactions")
      .select("id")
      .eq("gift_card_id", finalGiftCard.id)
      .eq("transaction_type", "purchase")
      .maybeSingle();

    if (!existingTransaction) {
      await supabase
        .from("gift_card_transactions")
        .insert({
          gift_card_id: finalGiftCard.id,
          amount_cents: purchasePriceCents,
          visit_count: cardType === "service_pass" ? parseInt(metadata.gc_visit_count) : 0,
          transaction_type: "purchase",
          description: `${cardType === "service_pass" ? "Service pass" : "Gift card"} purchased by ${metadata.customer_name}`,
        });
      console.log("Created purchase transaction for gift card");
    } else {
      console.log("Purchase transaction already exists, skipping");
    }

    if (metadata.gc_recipient_email) {
      const { data: giftCardBusiness } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', metadata.business_id)
        .maybeSingle();

      await supabase.functions.invoke("send-business-email", {
        body: {
          business_id: metadata.business_id,
          event_key: "gift_card_received",
          recipient_email: metadata.gc_recipient_email,
          recipient_name: metadata.gc_recipient_email.split('@')[0],
          variables: {
            recipient_email: metadata.gc_recipient_email,
            gift_card_code: metadata.gc_code,
            amount: cardType === "service_pass"
              ? `${metadata.gc_service_pass_name} · ${metadata.gc_visit_count} ${metadata.gc_visit_count === "1" ? "visit" : "visits"}`
              : new Intl.NumberFormat("en", { style: "currency", currency: (session.currency || "usd").toUpperCase() }).format(purchasePriceCents / 100),
            message: metadata.gc_message || "",
            sender_name: metadata.customer_name,
            business_name: giftCardBusiness?.name || 'Our Business',
          },
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Gift card processed successfully",
        giftCardId: finalGiftCard.id
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
