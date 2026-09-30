import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { agentJson, agentError, handleAgentOptions } from "../_shared/agentCors.ts";

// POST /agent/v1/approve — one-tap merchant approval from the notification email.
//
// The approval_token (random uuid, emailed only to the merchant) is the
// credential: it can only preview, approve, or decline that single pending
// agent booking. It never grants access to anything else.
//   { token, action: "preview" }  → booking summary
//   { token, action: "approve" }  → pending → confirmed
//   { token, action: "decline" }  → pending → cancelled

type ApproveAction = "preview" | "approve" | "decline";

const ACTIONS: ApproveAction[] = ["preview", "approve", "decline"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NEXT_STATUS: Record<Exclude<ApproveAction, "preview">, string> = {
  approve: "confirmed",
  decline: "cancelled",
};

interface ApproveRequest {
  token?: string;
  action?: ApproveAction;
}

interface BookingSummary {
  id: string;
  status: string;
  booking_date: string;
  start_time: string;
  customer_name: string | null;
  services: { name: string } | null;
  specialists: { name: string } | null;
  businesses: { name: string } | null;
}

function toSummary(b: BookingSummary) {
  return {
    status: b.status,
    date: b.booking_date,
    startTime: b.start_time.slice(0, 5),
    customerName: b.customer_name,
    service: b.services?.name ?? null,
    specialist: b.specialists?.name ?? null,
    business: b.businesses?.name ?? null,
  };
}

Deno.serve(async (req: Request) => {
  const options = handleAgentOptions(req);
  if (options) return options;
  if (req.method !== "POST") return agentError("Method not allowed", 405);

  try {
    const body = (await req.json().catch(() => ({}))) as ApproveRequest;
    const action = body.action ?? "preview";
    if (!body.token || !UUID_PATTERN.test(body.token)) {
      return agentError("Invalid approval link", 400);
    }
    if (!ACTIONS.includes(action)) return agentError("Unknown action", 400);

    const supabase = publicServiceClient();
    const { data: link, error: linkError } = await supabase
      .from("agent_bookings")
      .select("booking_id, business_id")
      .eq("approval_token", body.token)
      .maybeSingle();
    if (linkError || !link) return agentError("This approval link is not valid", 404);

    const select =
      "id, status, booking_date, start_time, customer_name, services(name), specialists(name), businesses(name)";
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(select)
      .eq("id", link.booking_id)
      .eq("business_id", link.business_id)
      .maybeSingle();
    if (error || !booking) return agentError("Booking not found", 404);

    const summary = booking as unknown as BookingSummary;
    if (action === "preview" || summary.status !== "pending") {
      return agentJson({ booking: toSummary(summary), changed: false });
    }

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({ status: NEXT_STATUS[action], updated_at: new Date().toISOString() })
      .eq("id", summary.id)
      .eq("status", "pending")
      .select(select)
      .single();
    if (updateError || !updated) {
      console.error("agent-approve update failed", updateError);
      return agentError("Could not update the booking. Please try again.", 500);
    }

    await supabase.from("agent_events").insert({
      business_id: link.business_id,
      action: action === "approve" ? "merchant_approve" : "merchant_decline",
      payload: { bookingId: summary.id },
      result: NEXT_STATUS[action],
    });

    return agentJson({ booking: toSummary(updated as unknown as BookingSummary), changed: true });
  } catch (err) {
    console.error("agent-approve failed", err);
    return agentError("Something went wrong", 500);
  }
});
