import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PayPalOrderRequest {
  bookingId?: string;
  giftCardId?: string;
  customerEmail: string;
  customerName: string;
  amount: number; // in the business's configured currency units
  serviceName: string;
  specialistName?: string;
  dateTime?: string;
  isGiftCard?: boolean;
  businessId?: string;
  giftCardData?: {
    code: string;
    cardType?: "value" | "service_pass";
    servicePassOfferId?: string | null;
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

    const requestData: PayPalOrderRequest = await req.json();
    const { bookingId, customerEmail, customerName, amount, serviceName, specialistName, dateTime, isGiftCard, giftCardData } = requestData;
    let businessId = requestData.businessId;
    let orderAmount = amount;

    // Bookings are the source of truth for tenant, payer, and remaining total.
    if (bookingId) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("business_id, customer_email, final_amount_cents")
        .eq("id", bookingId)
        .maybeSingle();

      if (booking) {
        if (booking.customer_email?.trim().toLowerCase() !== customerEmail.trim().toLowerCase()) {
          throw new Error("Booking details do not match");
        }
        if (businessId && businessId !== booking.business_id) {
          throw new Error("Booking does not belong to this business");
        }
        businessId = booking.business_id;
        orderAmount = Math.max(0, Number(booking.final_amount_cents || 0)) / 100;
      } else {
        throw new Error("Booking not found");
      }
    }

    if (!businessId) {
      throw new Error("Could not determine business ID");
    }

    // Get PayPal credentials and currency preference for this business
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("business_id", businessId)
      .in("key", ["paypal_enabled", "paypal_client_id", "paypal_secret", "currency"]);

    const settingsMap: { [key: string]: string } = {};
    if (settings) {
      settings.forEach((setting: { key: string; value: string }) => {
        let value = setting.value;

        // Handle potential double-encoding or JSON-stringified values
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'string') {
            value = parsed;
          } else if (typeof parsed === 'boolean') {
            value = parsed.toString();
          }
        } catch {
          // Not JSON, use as-is but trim whitespace
          value = value.trim();
        }

        // Remove any remaining wrapper quotes
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        settingsMap[setting.key] = value.trim();
      });
    }

    const paypalClientId = settingsMap.paypal_client_id || "";
    const paypalSecret = settingsMap.paypal_secret || "";
    const currencyCode = (settingsMap.currency || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Error("The business owner must choose a valid currency in Settings before accepting PayPal payments");
    }

    console.log(`PayPal credentials check - Client ID length: ${paypalClientId.length}, Secret length: ${paypalSecret.length}`);

    if (!paypalClientId || !paypalSecret) {
      throw new Error("PayPal credentials not configured for this business. Please add your PayPal Client ID and Secret in Payment Settings.");
    }

    // Get PayPal access token
    console.log("Attempting PayPal authentication...");
    const authResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${paypalClientId}:${paypalSecret}`)}`
      },
      body: "grant_type=client_credentials"
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("PayPal auth error:", errorText);
      
      // Provide helpful error message
      if (authResponse.status === 401) {
        throw new Error("PayPal authentication failed. Please check that your PayPal Client ID and Secret are correct and are LIVE credentials (not sandbox).");
      }
      throw new Error(`Failed to authenticate with PayPal: ${errorText}`);
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Build order description
    let description = serviceName;
    if (specialistName) {
      description += ` with ${specialistName}`;
    }
    if (dateTime) {
      description += ` - ${dateTime}`;
    }

    // Build custom_id with minimal metadata (PayPal limits to 127 chars)
    // Store full metadata in database instead
    let customId: string;
    
    if (isGiftCard && giftCardData) {
      const cardType = giftCardData.cardType === "service_pass" ? "service_pass" : "value";
      const { data: giftSettings } = await supabase
        .from("gift_card_settings")
        .select("enabled, preset_amounts_cents, allow_custom_amount, min_custom_amount_cents, max_custom_amount_cents, expiry_days")
        .eq("business_id", businessId)
        .maybeSingle();

      if (!giftSettings?.enabled) {
        throw new Error("Gift cards and passes are not enabled for this business");
      }

      let giftMetadata: Record<string, string | number | null>;
      if (cardType === "service_pass") {
        if (!giftCardData.servicePassOfferId) {
          throw new Error("A service-pass offer is required");
        }

        const { data: offer } = await supabase
          .from("service_pass_offers")
          .select("id, name, service_id, duration_id, visit_count, price_cents, expiry_days, is_active")
          .eq("id", giftCardData.servicePassOfferId)
          .eq("business_id", businessId)
          .eq("is_active", true)
          .maybeSingle();

        if (!offer) {
          throw new Error("This service pass is no longer available");
        }

        const expiryDays = offer.expiry_days ?? giftSettings.expiry_days;
        orderAmount = offer.price_cents / 100;
        giftMetadata = {
          gc_card_type: "service_pass",
          gc_amount: String(offer.price_cents),
          gc_service_pass_offer_id: offer.id,
          gc_service_pass_name: offer.name,
          gc_service_id: offer.service_id,
          gc_duration_id: offer.duration_id,
          gc_visit_count: String(offer.visit_count),
          gc_expires_at: expiryDays
            ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
            : null,
        };
      } else {
        const valueCents = Math.round(giftCardData.originalValueCents);
        const isPreset = (giftSettings.preset_amounts_cents || []).includes(valueCents);
        const isAllowedCustom = giftSettings.allow_custom_amount
          && valueCents >= giftSettings.min_custom_amount_cents
          && valueCents <= giftSettings.max_custom_amount_cents;
        if (valueCents <= 0 || (!isPreset && !isAllowedCustom)) {
          throw new Error("The selected gift-card value is not available");
        }

        orderAmount = valueCents / 100;
        giftMetadata = {
          gc_card_type: "value",
          gc_amount: String(valueCents),
          gc_expires_at: giftSettings.expiry_days
            ? new Date(Date.now() + giftSettings.expiry_days * 24 * 60 * 60 * 1000).toISOString()
            : null,
        };
      }

      // Store gift card data in a temporary record and reference it
      const { data: tempRecord, error: tempError } = await supabase
        .from("site_settings")
        .upsert({
          business_id: businessId,
          key: `paypal_temp_gc_${giftCardData.code}`,
          value: JSON.stringify({
            business_id: businessId,
            customer_name: customerName,
            customer_email: customerEmail,
            type: "gift_card",
            gc_code: giftCardData.code,
            ...giftMetadata,
            gc_recipient_email: giftCardData.purchasedForEmail || null,
            gc_message: giftCardData.message || null,
            currency_code: currencyCode,
          }),
          category: "paypal_temp",
        }, { onConflict: 'business_id,key' })
        .select();

      if (tempError || !tempRecord) {
        throw new Error("Could not prepare the gift-card purchase");
      }
      
      // Short custom_id format: gc|business_id_prefix|code
      customId = `gc|${businessId.substring(0, 8)}|${giftCardData.code}`;
    } else if (bookingId) {
      // For bookings, just store booking ID - we can look up everything else
      customId = `bk|${bookingId}`;
    } else {
      customId = `${businessId.substring(0, 8)}|${Date.now()}`;
    }

    // Create PayPal order. Deliberately omit `payment_source.paypal` / `experience_context`:
    // those force PayPal's redirect-based Advanced Checkout flow, which conflicts with the
    // in-page JS SDK Smart Buttons popup (createOrder/onApprove) used on the client. Leaving
    // payment_source unset lets the JS SDK drive the approval popup correctly.
    const orderResponse = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "PayPal-Request-Id": `${businessId}-${Date.now()}`, // Idempotency key
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: bookingId || `gc-${Date.now()}`,
          description: description.substring(0, 127), // PayPal limits to 127 chars
          custom_id: customId, // Now using short format
          amount: {
            currency_code: currencyCode,
            value: orderAmount.toFixed(2)
          }
        }]
      })
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      console.error("PayPal order creation error:", errorData);
      throw new Error(`Failed to create PayPal order: ${errorData}`);
    }

    const orderData = await orderResponse.json();
    console.log("PayPal order created:", orderData.id);

    return new Response(
      JSON.stringify({ 
        orderId: orderData.id,
        status: orderData.status
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error creating PayPal order:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create PayPal order" }),
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
