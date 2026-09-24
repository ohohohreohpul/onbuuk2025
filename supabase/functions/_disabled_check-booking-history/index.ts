import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Serial-offender gate for the booking page: anon clients can't read other
// customers' bookings under RLS, so history must be answered server-side.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { business_id, customer_email } = await req.json();
    if (!business_id || !customer_email) throw new Error("business_id and customer_email are required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("bookings")
      .select("id, status, no_show, booking_date")
      .eq("business_id", business_id)
      .eq("customer_email", customer_email)
      .gte("booking_date", ninetyDaysAgo);

    if (error) throw error;

    const noShows = (data || []).filter((b: any) => b.no_show === true).length;
    const lateCancels = (data || []).filter((b: any) => b.status === "cancelled" && !b.no_show).length;

    return new Response(JSON.stringify({
      no_shows: noShows,
      late_cancels: lateCancels,
      prepay_required: noShows >= 2,  // Treatwell rule: 2+ no-shows in 90 days → prepay-only
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("check-booking-history error:", err);
    return new Response(JSON.stringify({ error: err.message, prepay_required: false }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
