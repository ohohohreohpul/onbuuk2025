import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  authorizationErrorResponse,
  requireActiveAdmin,
} from "../_shared/adminAuthorization.ts";

// Charges a saved card off-session when a customer no-shows or late-cancels.
// Follows the Treatwell model: the card captured at booking guarantees the fee.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { businessId: adminBusinessId, supabaseAdmin: supabase } = await requireActiveAdmin(req);

    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("booking_id is required");

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, business_id, customer_email, customer_name, booking_date, start_time, service_id, stripe_payment_method_id, stripe_customer_id, no_show, no_show_fee_charged, status")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) throw new Error("Booking not found");
    if (booking.business_id !== adminBusinessId) {
      throw new Error("Booking not found");
    }
    if (booking.no_show_fee_charged) {
      return new Response(JSON.stringify({ charged: false, reason: "already_charged" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: service } = await supabase
      .from("services")
      .select("name, no_show_fee, no_show_fee_enabled")
      .eq("id", booking.service_id)
      .single();

    const feeAmount = Math.round(Number(service?.no_show_fee ?? 0)); // services.no_show_fee is already stored in cents
    if (!feeAmount || feeAmount <= 0) {
      return new Response(JSON.stringify({ charged: false, reason: "no_fee_configured" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!booking.stripe_payment_method_id || !booking.stripe_customer_id) {
      return new Response(JSON.stringify({ charged: false, reason: "no_card_on_file" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled, platform_fee_percentage")
      .eq("id", booking.business_id)
      .maybeSingle();

    if (!business?.stripe_connect_account_id || !business.stripe_connect_charges_enabled) {
      return new Response(
        JSON.stringify({ charged: false, reason: "payments_not_connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured for the Zenno platform");
    }

    const { data: currencyRow } = await supabase
      .from("site_settings").select("value").eq("business_id", booking.business_id).eq("key", "currency").maybeSingle();
    const currency = (currencyRow?.value || "").toLowerCase().replace(/"/g, "").trim();
    if (!/^[a-z]{3}$/.test(currency)) {
      throw new Error("The business owner must choose a valid currency before a no-show fee can be charged");
    }

    const params = new URLSearchParams({
      amount: feeAmount.toString(),
      currency,
      customer: booking.stripe_customer_id,
      payment_method: booking.stripe_payment_method_id,
      off_session: "true",
      confirm: "true",
      description: `No-show fee — ${service?.name || "appointment"} on ${booking.booking_date}`,
      "metadata[type]": "no_show_fee",
      "metadata[booking_id]": booking.id,
      "metadata[business_id]": booking.business_id,
    });

    const platformFeePct = business.platform_fee_percentage || 2.5;
    params.set("application_fee_amount", Math.round(feeAmount * platformFeePct / 100).toString());
    params.set("on_behalf_of", business.stripe_connect_account_id);
    params.set("transfer_data[destination]", business.stripe_connect_account_id);

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `no-show-fee-${booking.id}`,
      },
      body: params,
    });

    if (!stripeRes.ok) {
      const errText = await stripeRes.text();
      console.error("Stripe charge failed:", errText);
      return new Response(
        JSON.stringify({ charged: false, reason: "charge_failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const charge = await stripeRes.json();

    await supabase.from("bookings").update({ no_show_fee_charged: true }).eq("id", booking.id);

    const { data: customer } = await supabase.from("customers").select("id").eq("business_id", booking.business_id).eq("email", booking.customer_email).maybeSingle();

    await supabase.from("no_show_fees").upsert({
      booking_id: booking.id,
      customer_id: customer?.id || null,
      amount: feeAmount,
      reason: "no_show",
      paid: true,
      paid_at: new Date().toISOString(),
      resolution_status: "paid",
      resolved_at: new Date().toISOString(),
      resolution_note: "Charged automatically to the saved card guarantee",
      notes: `Charged card on file (${charge.id})`,
    }, { onConflict: "booking_id" });

    await supabase.functions.invoke("send-business-email", {
      body: {
        business_id: booking.business_id,
        event_key: "no_show_fee_charged",
        recipient_email: booking.customer_email,
        recipient_name: booking.customer_name,
        variables: {
          customer_name: booking.customer_name,
          service_name: service?.name || "your appointment",
          booking_date: booking.booking_date,
          fee_amount: new Intl.NumberFormat("en", {
            style: "currency",
            currency: currency.toUpperCase(),
          }).format(feeAmount / 100),
        },
        booking_id: booking.id,
      },
    }).catch(e => console.error("no-show email failed:", e));

    return new Response(JSON.stringify({ charged: true, payment_intent: charge.id, amount: feeAmount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const authResponse = authorizationErrorResponse(err, corsHeaders);
    if (authResponse) return authResponse;

    console.error("charge-no-show-fee error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
