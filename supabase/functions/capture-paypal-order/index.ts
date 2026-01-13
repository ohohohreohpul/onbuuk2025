import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CaptureRequest {
  orderId: string;
  businessId: string;
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

    const { orderId, businessId }: CaptureRequest = await req.json();

    if (!orderId || !businessId) {
      throw new Error("orderId and businessId are required");
    }

    // Get PayPal credentials for this business
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("business_id", businessId)
      .in("key", ["paypal_client_id", "paypal_secret"]);

    const settingsMap: { [key: string]: string } = {};
    if (settings) {
      settings.forEach((setting: { key: string; value: string }) => {
        let value = setting.value;
        
        // Handle potential double-encoding or JSON-stringified values
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'string') {
            value = parsed;
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
      throw new Error("Failed to authenticate with PayPal");
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Capture the order
    const captureResponse = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!captureResponse.ok) {
      const errorData = await captureResponse.text();
      console.error("PayPal capture error:", errorData);
      throw new Error(`Failed to capture PayPal order: ${errorData}`);
    }

    const captureData = await captureResponse.json();
    console.log("PayPal order captured:", captureData.id, captureData.status);

    // Process based on custom_id format
    if (captureData.status === "COMPLETED") {
      const purchaseUnit = captureData.purchase_units?.[0];
      const customId = purchaseUnit?.payments?.captures?.[0]?.custom_id || purchaseUnit?.custom_id || "";
      
      console.log("Processing payment with custom_id:", customId);

      // Parse the short custom_id format: type|business_prefix|identifier
      const parts = customId.split("|");
      const type = parts[0]; // 'gc' for gift card, 'bk' for booking
      
      if (type === "bk" && parts[1]) {
        // Booking payment
        const bookingId = parts[1];
        
        const { error: bookingError } = await supabase
          .from("bookings")
          .update({
            payment_status: "completed",
            status: "confirmed",
            paypal_order_id: orderId,
          })
          .eq("id", bookingId);

        if (bookingError) {
          console.error("Error updating booking:", bookingError);
        } else {
          console.log("Booking confirmed:", bookingId);
          await sendBookingConfirmationEmail(supabase, bookingId);
        }
      } else if (type === "gc" && parts[2]) {
        // Gift card payment - retrieve metadata from temp storage
        const gcCode = parts[2];
        const tempKey = `paypal_temp_gc_${gcCode}`;
        
        const { data: tempData } = await supabase
          .from("site_settings")
          .select("value")
          .eq("business_id", businessId)
          .eq("key", tempKey)
          .maybeSingle();
        
        let metadata: any = {};
        if (tempData?.value) {
          try {
            metadata = JSON.parse(tempData.value);
          } catch (e) {
            console.error("Error parsing temp metadata:", e);
          }
        }
        
        console.log("Gift card metadata:", metadata);
        
        // Check if gift card already exists
        const { data: existingGiftCard } = await supabase
          .from("gift_cards")
          .select("id")
          .eq("code", gcCode)
          .maybeSingle();

        if (existingGiftCard) {
          // Update existing gift card with PayPal order ID
          await supabase
            .from("gift_cards")
            .update({ paypal_order_id: orderId, status: "active" })
            .eq("id", existingGiftCard.id);
          console.log("Gift card updated:", existingGiftCard.id);
        } else {
          // Create new gift card
          const { data: newGiftCard, error: giftCardError } = await supabase
            .from("gift_cards")
            .insert({
              business_id: metadata.business_id || businessId,
              code: gcCode,
              original_value_cents: parseInt(metadata.gc_amount) || 0,
              current_balance_cents: parseInt(metadata.gc_amount) || 0,
              status: "active",
              paypal_order_id: orderId,
              purchased_for_email: metadata.gc_recipient_email || null,
              expires_at: metadata.gc_expires_at || null,
            })
            .select()
            .single();

          if (giftCardError) {
            console.error("Error creating gift card:", giftCardError);
          } else {
            console.log("Gift card created:", newGiftCard.id);

            // Record transaction
            await supabase.from("gift_card_transactions").insert({
              gift_card_id: newGiftCard.id,
              amount_cents: parseInt(metadata.gc_amount) || 0,
              transaction_type: "purchase",
              description: `Purchased by ${metadata.customer_name || 'Customer'} via PayPal`,
            });

            // Send email to recipient if provided
            if (metadata.gc_recipient_email) {
              await sendGiftCardEmail(supabase, metadata, newGiftCard.id);
            }
          }
        }
        
        // Clean up temp data
        await supabase
          .from("site_settings")
          .delete()
          .eq("business_id", businessId)
          .eq("key", tempKey);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: captureData.status,
        orderId: captureData.id,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error capturing PayPal order:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to capture PayPal order" }),
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

async function sendBookingConfirmationEmail(supabase: any, bookingId: string) {
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("customer_email, customer_name, service_id, duration_id, specialist_id, booking_date, start_time, business_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (!booking) return;

    const { data: service } = await supabase
      .from("services")
      .select("name")
      .eq("id", booking.service_id)
      .maybeSingle();

    const { data: duration } = await supabase
      .from("service_durations")
      .select("duration_minutes, price_cents")
      .eq("id", booking.duration_id)
      .maybeSingle();

    const { data: business } = await supabase
      .from("businesses")
      .select("name, address, phone")
      .eq("id", booking.business_id)
      .maybeSingle();

    let specialistName = "Any Available Specialist";
    if (booking.specialist_id) {
      const { data: specialist } = await supabase
        .from("specialists")
        .select("name")
        .eq("id", booking.specialist_id)
        .maybeSingle();
      if (specialist) {
        specialistName = specialist.name;
      }
    }

    const calculateEndTime = (startTime: string, durationMinutes: number): string => {
      const [hours, minutes] = startTime.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + durationMinutes;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
    };

    const formattedDate = new Date(booking.booking_date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const endTime = duration ? calculateEndTime(booking.start_time, duration.duration_minutes) : booking.start_time;
    const cancelUrl = `${Deno.env.get("SUPABASE_URL")?.replace("/functions/v1", "")}/cancel?id=${bookingId}`;

    await supabase.functions.invoke("send-business-email", {
      body: {
        business_id: booking.business_id,
        event_key: "booking_confirmation",
        recipient_email: booking.customer_email,
        recipient_name: booking.customer_name,
        variables: {
          customer_name: booking.customer_name,
          customer_email: booking.customer_email,
          service_name: service?.name || "Service",
          service_duration: duration ? `${duration.duration_minutes} minutes` : "N/A",
          service_price: duration ? `€${(duration.price_cents / 100).toFixed(2)}` : "N/A",
          booking_date: formattedDate,
          booking_time: booking.start_time,
          booking_end_time: endTime,
          specialist_name: specialistName,
          business_name: business?.name || "Our Business",
          business_address: business?.address || "",
          business_phone: business?.phone || "",
          business_email: "",
          cancellation_link: cancelUrl,
          reschedule_link: cancelUrl,
        },
        booking_id: bookingId,
      },
    });

    console.log("Booking confirmation email sent");
  } catch (error) {
    console.error("Error sending booking confirmation email:", error);
  }
}

async function sendGiftCardEmail(supabase: any, metadata: any, giftCardId: string) {
  try {
    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", metadata.business_id)
      .maybeSingle();

    await supabase.functions.invoke("send-business-email", {
      body: {
        business_id: metadata.business_id,
        event_key: "gift_card_received",
        recipient_email: metadata.gc_recipient_email,
        recipient_name: metadata.gc_recipient_email.split("@")[0],
        variables: {
          recipient_email: metadata.gc_recipient_email,
          gift_card_code: metadata.gc_code,
          amount: `€${(parseInt(metadata.gc_amount) / 100).toFixed(2)}`,
          message: metadata.gc_message || "",
          sender_name: metadata.customer_name,
          business_name: business?.name || "Our Business",
        },
      },
    });

    console.log("Gift card email sent");
  } catch (error) {
    console.error("Error sending gift card email:", error);
  }
}
