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
        try {
          settingsMap[setting.key] = JSON.parse(setting.value);
        } catch {
          settingsMap[setting.key] = setting.value;
        }
      });
    }

    const paypalClientId = settingsMap.paypal_client_id || "";
    const paypalSecret = settingsMap.paypal_secret || "";

    if (!paypalClientId || !paypalSecret) {
      throw new Error("PayPal credentials not configured for this business");
    }

    // Get PayPal access token
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
      throw new Error("Failed to authenticate with PayPal");
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

    // Build custom_id with metadata
    const metadata: any = {
      business_id: businessId,
      customer_name: customerName,
      customer_email: customerEmail,
    };

    if (isGiftCard && giftCardData) {
      metadata.type = "gift_card";
      metadata.gc_code = giftCardData.code;
      metadata.gc_amount = giftCardData.originalValueCents.toString();
      if (giftCardData.purchasedForEmail) {
        metadata.gc_recipient_email = giftCardData.purchasedForEmail;
      }
      if (giftCardData.expiresAt) {
        metadata.gc_expires_at = giftCardData.expiresAt;
      }
      if (giftCardData.message) {
        metadata.gc_message = giftCardData.message;
      }
    } else if (bookingId) {
      metadata.type = "booking";
      metadata.booking_id = bookingId;
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
          custom_id: JSON.stringify(metadata),
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
