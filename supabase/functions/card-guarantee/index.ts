import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SetupIntentRequest {
  bookingId: string;
  customerEmail: string;
  customerName: string;
  businessId: string;
}

interface ChargeNoShowRequest {
  noShowFeeId: string;
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

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "create-setup-intent";

    // Get business Stripe secret key
    const getStripeKey = async (businessId: string): Promise<string> => {
      const { data: settings } = await supabase
        .from("site_settings")
        .select("value")
        .eq("business_id", businessId)
        .eq("key", "stripe_secret_key")
        .maybeSingle();

      if (settings?.value) {
        try {
          return JSON.parse(settings.value);
        } catch {
          return settings.value;
        }
      }

      // Fallback to platform key
      const platformKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (platformKey) {
        return platformKey;
      }

      throw new Error("Stripe secret key not configured for this business");
    };

    if (action === "create-setup-intent") {
      // Create a SetupIntent to save card for future charges
      const requestData: SetupIntentRequest = await req.json();
      const { bookingId, customerEmail, customerName, businessId } = requestData;

      if (!businessId) {
        throw new Error("Business ID is required");
      }

      const stripeSecretKey = await getStripeKey(businessId);

      // First, create or get customer in Stripe
      const customerSearchResponse = await fetch(
        `https://api.stripe.com/v1/customers?email=${encodeURIComponent(customerEmail)}&limit=1`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${stripeSecretKey}`,
          },
        }
      );

      const customerSearchData = await customerSearchResponse.json();
      let stripeCustomerId: string;

      if (customerSearchData.data && customerSearchData.data.length > 0) {
        stripeCustomerId = customerSearchData.data[0].id;
      } else {
        // Create new customer
        const createCustomerResponse = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: customerEmail,
            name: customerName,
            "metadata[business_id]": businessId,
          }),
        });

        const newCustomer = await createCustomerResponse.json();
        if (newCustomer.error) {
          throw new Error(newCustomer.error.message);
        }
        stripeCustomerId = newCustomer.id;
      }

      // Create SetupIntent
      const setupIntentParams = new URLSearchParams({
        customer: stripeCustomerId,
        "payment_method_types[0]": "card",
        "metadata[booking_id]": bookingId,
        "metadata[business_id]": businessId,
        usage: "off_session", // Important: allows charging the card later without customer present
      });

      const setupIntentResponse = await fetch("https://api.stripe.com/v1/setup_intents", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: setupIntentParams,
      });

      const setupIntent = await setupIntentResponse.json();

      if (setupIntent.error) {
        throw new Error(setupIntent.error.message);
      }

      // Get publishable key for frontend
      const { data: publishableKeyData } = await supabase
        .from("site_settings")
        .select("value")
        .eq("business_id", businessId)
        .eq("key", "stripe_publishable_key")
        .maybeSingle();

      let publishableKey = publishableKeyData?.value || Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";
      try {
        publishableKey = JSON.parse(publishableKey);
      } catch {
        // Keep as is
      }

      return new Response(
        JSON.stringify({
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id,
          customerId: stripeCustomerId,
          publishableKey,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (action === "confirm-card-saved") {
      // Called after card is saved to store payment method on booking
      const { bookingId, paymentMethodId, customerId, businessId } = await req.json();

      // Update booking with payment method info
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          stripe_payment_method_id: paymentMethodId,
          stripe_customer_id: customerId,
          card_on_file: true,
        })
        .eq("id", bookingId);

      if (updateError) {
        throw new Error(`Failed to update booking: ${updateError.message}`);
      }

      // Also update customer record
      const { data: booking } = await supabase
        .from("bookings")
        .select("customer_email")
        .eq("id", bookingId)
        .maybeSingle();

      if (booking?.customer_email) {
        await supabase
          .from("customers")
          .update({
            stripe_customer_id: customerId,
          })
          .eq("business_id", businessId)
          .eq("email", booking.customer_email);
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (action === "charge-no-show") {
      // Charge a saved card for no-show fee
      const requestData: ChargeNoShowRequest = await req.json();
      const { noShowFeeId, businessId } = requestData;

      if (!noShowFeeId || !businessId) {
        throw new Error("noShowFeeId and businessId are required");
      }

      const stripeSecretKey = await getStripeKey(businessId);

      // Get no-show fee details
      const { data: noShowFee, error: feeError } = await supabase
        .from("no_show_fees")
        .select(`
          *,
          booking:bookings(
            stripe_customer_id,
            stripe_payment_method_id,
            customer_name,
            customer_email
          )
        `)
        .eq("id", noShowFeeId)
        .maybeSingle();

      if (feeError || !noShowFee) {
        throw new Error("No-show fee not found");
      }

      if (noShowFee.paid) {
        throw new Error("This fee has already been paid");
      }

      const booking = noShowFee.booking;
      if (!booking?.stripe_customer_id || !booking?.stripe_payment_method_id) {
        throw new Error("No saved card found for this booking");
      }

      // Create PaymentIntent and charge the saved card
      const paymentIntentParams = new URLSearchParams({
        amount: noShowFee.amount.toString(),
        currency: "eur",
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        off_session: "true",
        confirm: "true",
        description: `No-show fee for booking`,
        "metadata[no_show_fee_id]": noShowFeeId,
        "metadata[business_id]": businessId,
        "metadata[booking_id]": noShowFee.booking_id,
      });

      const paymentIntentResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: paymentIntentParams,
      });

      const paymentIntent = await paymentIntentResponse.json();

      if (paymentIntent.error) {
        // Card was declined or other error
        throw new Error(paymentIntent.error.message);
      }

      if (paymentIntent.status === "succeeded") {
        // Update no-show fee as paid
        await supabase
          .from("no_show_fees")
          .update({
            paid: true,
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: paymentIntent.id,
            notes: `Charged automatically via saved card`,
          })
          .eq("id", noShowFeeId);

        return new Response(
          JSON.stringify({
            success: true,
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      } else if (paymentIntent.status === "requires_action") {
        // 3D Secure required - customer needs to authenticate
        throw new Error("Card requires authentication. Please contact the customer.");
      } else {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Error in card-guarantee function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
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
