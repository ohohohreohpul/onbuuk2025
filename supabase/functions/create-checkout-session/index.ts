import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CheckoutRequest {
  bookingId?: string;
  giftCardId?: string;
  /** Pay-at-venue guarantee: collect card details only, charge later if no-show (Treatwell model) */
  cardOnly?: boolean;
  customerEmail: string;
  customerName: string;
  amount: number;
  serviceName: string;
  specialistName: string;
  dateTime: string;
  isGiftCard?: boolean;
  businessId?: string;
  cardGuaranteeConsent?: boolean;
  cardGuaranteePolicyVersion?: string;
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

    const requestData: CheckoutRequest = await req.json();
    const { bookingId, giftCardId, customerEmail, customerName, amount, serviceName, specialistName, dateTime, isGiftCard, giftCardData } = requestData;
    let businessId = requestData.businessId;
    let bookingAmountCents: number | null = null;
    let bookingServiceId: string | null = null;
    let giftCardAmountCents: number | null = null;

    if (bookingId) {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("business_id, customer_email, final_amount_cents, service_id")
        .eq("id", bookingId)
        .maybeSingle();

      if (bookingError || !booking) {
        throw new Error("Booking not found");
      }

      if (booking.customer_email?.trim().toLowerCase() !== customerEmail.trim().toLowerCase()) {
        throw new Error("Booking details do not match");
      }

      businessId = booking.business_id;
      bookingAmountCents = booking.final_amount_cents;
      bookingServiceId = booking.service_id;
    }

    if (!businessId && giftCardId) {
      const { data: giftCard } = await supabase
        .from("gift_cards")
        .select("business_id")
        .eq("id", giftCardId)
        .maybeSingle();

      if (giftCard) {
        businessId = giftCard.business_id;
      }
    }

    if (!businessId) {
      throw new Error("Could not determine business ID");
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_charges_enabled, platform_fee_percentage")
      .eq("id", businessId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("business_id", businessId)
      .in("key", ["stripe_enabled", "currency"]);

    const settingsMap: { [key: string]: string } = {};
    if (settings) {
      settings.forEach((setting: { key: string; value: string }) => {
        let value = setting.value;
        
        // Handle potential double-encoding or JSON-stringified values
        // First, try to parse as JSON to remove any quotes
        try {
          const parsed = JSON.parse(value);
          // If parsed successfully and it's a string, use it
          if (typeof parsed === 'string') {
            value = parsed;
          } else if (typeof parsed === 'boolean') {
            value = parsed.toString();
          }
        } catch {
          // Not JSON, use as-is but trim whitespace
          value = value.trim();
        }
        
        // Remove any remaining wrapper quotes (in case of double encoding)
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        
        settingsMap[setting.key] = value;
      });
    }

    if (settingsMap.stripe_enabled !== "true") {
      throw new Error("Card payments are not enabled for this business");
    }

    const currency = (settingsMap.currency || "").trim().toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) {
      throw new Error("The business owner must choose a valid currency in Settings before accepting payments");
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured for the Zenno platform");
    }

    if (
      !business ||
      !business.stripe_connect_account_id ||
      !business.stripe_connect_onboarding_complete ||
      !business.stripe_connect_charges_enabled
    ) {
      throw new Error("The business owner must finish Stripe onboarding before accepting card payments");
    }
    const connectedAccountId = business.stripe_connect_account_id;

    const origin = req.headers.get("origin") || "";

    let successUrl: string;
    let cancelUrl: string;
    let productName: string;
    let productDescription: string;
    const metadata: { [key: string]: string } = {
      "customer_name": customerName,
      "customer_email": customerEmail,
      "business_id": businessId,
    };

    const { data: businessData } = await supabase
      .from("businesses")
      .select("subdomain")
      .eq("id", businessId)
      .maybeSingle();

    const businessSubdomain = businessData?.subdomain || '';
    const cancelUrlParams = businessSubdomain ? `?from=${businessSubdomain}` : '';

    if (isGiftCard) {
      if (giftCardId) {
        // Legacy: existing gift card (already created)
        successUrl = `${origin}/gift-card-success?session_id={CHECKOUT_SESSION_ID}&gift_card_id=${giftCardId}`;
        cancelUrl = `${origin}/payment-cancelled${cancelUrlParams}`;
        productName = serviceName;
        productDescription = dateTime;
        metadata["gift_card_id"] = giftCardId;
        metadata["type"] = "gift_card";
      } else if (giftCardData) {
        // New flow: gift card data passed, will be created after payment
        successUrl = `${origin}/gift-card-success?session_id={CHECKOUT_SESSION_ID}&business_id=${businessId}`;
        cancelUrl = `${origin}/payment-cancelled${cancelUrlParams}`;
        const cardType = giftCardData.cardType || "value";
        const { data: giftSettings } = await supabase
          .from("gift_card_settings")
          .select("enabled, preset_amounts_cents, allow_custom_amount, min_custom_amount_cents, max_custom_amount_cents, expiry_days")
          .eq("business_id", businessId)
          .maybeSingle();

        if (!giftSettings?.enabled) {
          throw new Error("Gift cards and passes are not enabled for this business");
        }

        let expiresAt = giftCardData.expiresAt;
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

          giftCardAmountCents = offer.price_cents;
          const expiryDays = offer.expiry_days ?? giftSettings.expiry_days;
          expiresAt = expiryDays
            ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
            : null;
          productName = offer.name;
          productDescription = `${offer.visit_count} ${offer.visit_count === 1 ? "visit" : "visits"} · ${dateTime}`;
          metadata["gc_card_type"] = "service_pass";
          metadata["gc_service_pass_offer_id"] = offer.id;
          metadata["gc_service_pass_name"] = offer.name;
          metadata["gc_service_id"] = offer.service_id;
          metadata["gc_duration_id"] = offer.duration_id;
          metadata["gc_visit_count"] = offer.visit_count.toString();
        } else {
          const valueCents = Math.round(giftCardData.originalValueCents);
          const isPreset = (giftSettings.preset_amounts_cents || []).includes(valueCents);
          const isAllowedCustom = giftSettings.allow_custom_amount
            && valueCents >= giftSettings.min_custom_amount_cents
            && valueCents <= giftSettings.max_custom_amount_cents;

          if (valueCents <= 0 || (!isPreset && !isAllowedCustom)) {
            throw new Error("The selected gift-card value is not available");
          }

          giftCardAmountCents = valueCents;
          expiresAt = giftSettings.expiry_days
            ? new Date(Date.now() + giftSettings.expiry_days * 24 * 60 * 60 * 1000).toISOString()
            : null;
          productName = serviceName;
          productDescription = dateTime;
          metadata["gc_card_type"] = "value";
        }

        metadata["type"] = "gift_card_new";
        metadata["gc_code"] = giftCardData.code;
        metadata["gc_amount"] = giftCardAmountCents.toString();
        if (giftCardData.purchasedForEmail) {
          metadata["gc_recipient_email"] = giftCardData.purchasedForEmail;
        }
        if (expiresAt) {
          metadata["gc_expires_at"] = expiresAt;
        }
        if (giftCardData.message) {
          metadata["gc_message"] = giftCardData.message;
        }
      } else {
        throw new Error("Gift card requires either giftCardId or giftCardData");
      }
    } else if (bookingId) {
      successUrl = `${origin}/booking-success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`;
      cancelUrl = `${origin}/payment-cancelled${cancelUrlParams}`;
      productName = `${serviceName} with ${specialistName}`;
      productDescription = `Appointment on ${dateTime}`;
      metadata["booking_id"] = bookingId;
      metadata["type"] = "booking";
    } else {
      throw new Error("Either bookingId or giftCardId must be provided");
    }

    const amountInCents = bookingId && bookingAmountCents !== null
      ? Math.max(0, bookingAmountCents)
      : giftCardAmountCents !== null
        ? giftCardAmountCents
        : Math.round(amount * 100);
    const cardOnly = requestData.cardOnly === true;

    // Card guarantee mode (Treatwell): SetupIntent-only checkout — no charge now,
    // card saved for off-session no-show / late-cancel charges.
    if (cardOnly && bookingId) {
      if (requestData.cardGuaranteeConsent !== true) {
        throw new Error("Card-guarantee consent is required");
      }

      if (!bookingServiceId) {
        throw new Error("Booking service not found");
      }

      const { data: service } = await supabase
        .from("services")
        .select("no_show_fee, no_show_fee_enabled, late_cancel_hours")
        .eq("id", bookingServiceId)
        .eq("business_id", businessId)
        .maybeSingle();

      const guaranteeFeeCents = Number(service?.no_show_fee ?? 0);
      if (!service?.no_show_fee_enabled || guaranteeFeeCents <= 0) {
        throw new Error("This service does not have an active card guarantee");
      }

      const policyVersion = requestData.cardGuaranteePolicyVersion || "2026-09";
      const consentedAt = new Date().toISOString();
      const lateCancelHours = Number(service.late_cancel_hours ?? 24);

      const { error: consentError } = await supabase
        .from("bookings")
        .update({
          card_guarantee_consent_at: consentedAt,
          card_guarantee_policy_version: policyVersion,
          card_guarantee_fee_cents: guaranteeFeeCents,
          card_guarantee_late_cancel_hours: lateCancelHours,
          card_guarantee_currency: currency.toUpperCase(),
        })
        .eq("id", bookingId)
        .eq("business_id", businessId);

      if (consentError) {
        throw new Error("Card-guarantee consent could not be recorded");
      }

      metadata["connected_account_id"] = connectedAccountId;
      metadata["guarantee_fee_cents"] = guaranteeFeeCents.toString();
      metadata["late_cancel_hours"] = lateCancelHours.toString();
      metadata["policy_version"] = policyVersion;
      metadata["consented_at"] = consentedAt;

      const setupParams: { [key: string]: string } = {
        "mode": "setup",
        "currency": currency,
        "payment_method_types[0]": "card",
        "success_url": successUrl,
        "cancel_url": cancelUrl,
        "customer_email": customerEmail,
        "customer_creation": "always",
        "setup_intent_data[on_behalf_of]": connectedAccountId,
      };
      Object.keys(metadata).forEach((key) => {
        setupParams[`metadata[${key}]`] = metadata[key];
        setupParams[`setup_intent_data[metadata][${key}]`] = metadata[key];
      });
      setupParams["metadata[type]"] = "booking_card_guarantee";
      setupParams["setup_intent_data[metadata][type]"] = "booking_card_guarantee";

      const setupRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(setupParams),
      });
      if (!setupRes.ok) {
        const errText = await setupRes.text();
        console.error("Stripe setup-mode session error:", errText);
        throw new Error(`Unable to start card guarantee checkout: ${errText}`);
      }
      const session = await setupRes.json();
      return new Response(JSON.stringify({ sessionId: session.id, url: session.url, mode: "setup" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripeParams: { [key: string]: string } = {
      "mode": "payment",
      "success_url": successUrl,
      "cancel_url": cancelUrl,
      "customer_email": customerEmail,
      "allow_promotion_codes": "true",
      // Card-on-file: attach the payment method to a Stripe customer so the
      // business can charge late-cancel / no-show fees off-session.
      "customer_creation": "always",
      "payment_intent_data[setup_future_usage]": "off_session",
      "line_items[0][price_data][currency]": currency,
      "line_items[0][price_data][product_data][name]": productName,
      "line_items[0][price_data][product_data][description]": productDescription,
      "line_items[0][price_data][unit_amount]": amountInCents.toString(),
      "line_items[0][quantity]": "1",
    };

    const platformFeePercentage = business.platform_fee_percentage || 2.5;
    const applicationFee = Math.round(amountInCents * (platformFeePercentage / 100));

    stripeParams["payment_intent_data[application_fee_amount]"] = applicationFee.toString();
    stripeParams["payment_intent_data[on_behalf_of]"] = connectedAccountId;
    stripeParams["payment_intent_data[transfer_data][destination]"] = connectedAccountId;

    metadata["connected_account_id"] = connectedAccountId;
    metadata["platform_fee"] = applicationFee.toString();
    metadata["platform_fee_percentage"] = platformFeePercentage.toString();

    Object.keys(metadata).forEach((key) => {
      stripeParams[`metadata[${key}]`] = metadata[key];
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(stripeParams),
    });

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.text();
      console.error("Stripe API error response:", errorData);
      
      // Parse and provide more helpful error messages
      try {
        const errorJson = JSON.parse(errorData);
        throw new Error(`Stripe error: ${errorJson.error?.message || errorData}`);
      } catch (parseError) {
        throw new Error(`Stripe API error: ${errorData}`);
      }
    }

    const session = await stripeResponse.json();

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create checkout session" }),
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
