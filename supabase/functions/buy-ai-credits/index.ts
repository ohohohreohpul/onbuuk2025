import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { authorizationErrorResponse, requireActiveAdmin } from "../_shared/adminAuthorization.ts";
import { AI_PACKS, isAiPack, returnBase, shopCustomer, stripeClient } from "../_shared/billing/stripeBilling.ts";

// Buy a pack of AI replies (one-time Stripe Checkout). The webhook adds the replies
// once per checkout session (add_ai_credits).

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
    const admin = await requireActiveAdmin(req, { roles: ["owner", "admin", "manager"] });
    const { pack } = await req.json().catch(() => ({})) as { pack?: string };
    if (!isAiPack(pack)) return json({ error: "Unknown pack" }, 400);
    const { data: isPaid } = await supabase.rpc("business_is_paid", { p_business_id: admin.businessId });
    if (isPaid !== true) return json({ error: "AI replies are part of the Zenno plan. Please upgrade first." }, 400);

    const { replies, amountCents } = AI_PACKS[pack];
    const stripe = stripeClient();
    const customer = await shopCustomer(supabase, stripe, admin.businessId);
    const base = returnBase(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer,
      client_reference_id: admin.businessId,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: { name: `Zenno AI replies · ${replies.toLocaleString("en")}`, description: "Extra replies for your AI receptionist. They do not expire." },
        },
      }],
      metadata: { type: "ai_credits", business_id: admin.businessId, replies: String(replies), pack },
      invoice_creation: { enabled: true },
      success_url: `${base}/admin?view=receptionist&credits=success`,
      cancel_url: `${base}/admin?view=receptionist&credits=cancelled`,
    });
    return json({ url: session.url });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    console.error("credit checkout failed:", error);
    return json({ error: "Checkout could not be started. Please try again." }, 500);
  }
});
