import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { authorizationErrorResponse, requireActiveAdmin } from "../_shared/adminAuthorization.ts";
import { returnBase, shopCustomer, stripeClient } from "../_shared/billing/stripeBilling.ts";

// Upgrade to the Zenno plan (49 €/month): a Stripe Checkout subscription on the
// shop's own Stripe customer, so the webhook can link payment and shop.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const admin = await requireActiveAdmin(req, { roles: ["owner", "admin"] });
    const { coupon_code } = await req.json().catch(() => ({})) as { coupon_code?: string };
    const priceId = Deno.env.get("STRIPE_ZENNO_MONTHLY_PRICE_ID");
    if (!priceId) return json({ error: "The Zenno plan is not set up yet. Please contact support@zennohq.com." }, 503);

    const { data: business } = await supabase.from("businesses").select("plan_type, subscription_status").eq("id", admin.businessId).single();
    if (business?.plan_type === "custom") return json({ error: "Your shop has a custom plan. Please contact support@zennohq.com." }, 400);
    if (business?.plan_type === "pro" && ["active", "trialing", "past_due"].includes(business.subscription_status ?? "")) {
      return json({ error: "Your shop is already on the Zenno plan." }, 400);
    }

    const stripe = stripeClient();
    const customer = await shopCustomer(supabase, stripe, admin.businessId);
    const base = returnBase(req);
    const coupon = typeof coupon_code === "string" ? coupon_code.trim().slice(0, 100) : "";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: admin.businessId,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
      metadata: { kind: "zenno_plan", business_id: admin.businessId },
      subscription_data: { metadata: { kind: "zenno_plan", business_id: admin.businessId, plan_type: "pro" } },
      success_url: `${base}/admin?view=settings&tab=subscription&upgrade=success`,
      cancel_url: `${base}/admin?view=settings&tab=subscription&upgrade=cancelled`,
    });
    return json({ url: session.url });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    const message = error instanceof Error ? error.message : String(error);
    console.error("upgrade checkout failed:", message);
    return json({ error: /coupon/i.test(message) ? "Invalid or expired coupon code." : "Checkout could not be started. Please try again." }, 500);
  }
});
