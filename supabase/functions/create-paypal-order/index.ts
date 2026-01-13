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
  amount: number; // in currency units (e.g., 50.00 EUR)
  serviceName: string;
  specialistName?: string;
  dateTime?: string;
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

    const requestData: PayPalOrderRequest = await req.json();
    const { bookingId, customerEmail, customerName, amount, serviceName, specialistName, dateTime, isGiftCard, giftCardData } = requestData;
    let businessId = requestData.businessId;

    // Get business ID from booking if not provided
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

    if (!businessId) {
      throw new Error("Could not determine business ID");
    }

    // Get PayPal credentials for this business
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("business_id", businessId)
      .in("key", ["paypal_enabled", "paypal_client_id", "paypal_secret"]);

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

    // Get origin for return URLs
    const origin = req.headers.get("origin") || "";
    
    // Get business subdomain for cancel URL
    const { data: businessData } = await supabase
      .from("businesses")
      .select("subdomain")
      .eq("id", businessId)
      .maybeSingle();

    const businessSubdomain = businessData?.subdomain || '';
    const cancelUrlParams = businessSubdomain ? `?from=${businessSubdomain}` : '';

    // Build custom_id with minimal metadata (PayPal limits to 127 chars)
    // Store full metadata in database instead
    let customId: string;
    
    if (isGiftCard && giftCardData) {
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
            gc_amount: giftCardData.originalValueCents.toString(),
            gc_recipient_email: giftCardData.purchasedForEmail || null,
            gc_expires_at: giftCardData.expiresAt || null,
            gc_message: giftCardData.message || null,
          }),
          category: "paypal_temp",
        }, { onConflict: 'business_id,key' })
        .select();
      
      // Short custom_id format: gc|business_id_prefix|code
      customId = `gc|${businessId.substring(0, 8)}|${giftCardData.code}`;
    } else if (bookingId) {
      // For bookings, just store booking ID - we can look up everything else
      customId = `bk|${bookingId}`;
    } else {
      customId = `${businessId.substring(0, 8)}|${Date.now()}`;
    }

    // Create PayPal order
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
            currency_code: "EUR",
            value: amount.toFixed(2)
          }
        }],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              brand_name: "Booking",
              locale: "en-US",
              landing_page: "LOGIN",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: isGiftCard 
                ? `${origin}/gift-card-success?paypal=true&business_id=${businessId}`
                : `${origin}/booking-success?paypal=true&booking_id=${bookingId}`,
              cancel_url: `${origin}/payment-cancelled${cancelUrlParams}`
            }
          }
        }
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
