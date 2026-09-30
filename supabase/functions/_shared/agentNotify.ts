import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Merchant notification for agent bookings (Jev decision: email_only).
// Sends through the existing send-customer-email function so each business's
// own mail provider settings are reused. Never throws: a failed email must not
// fail a booking that already exists — failures are logged instead.
// ---------------------------------------------------------------------------

const MERCHANT_ROLES = ["owner", "admin"];

interface NotifyArgs {
  businessId: string;
  bookingId: string;
  status: string;
  approvalToken: string | null;
  agentName: string;
}

interface BookingDetails {
  booking_date: string;
  start_time: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  services: { name: string } | null;
  specialists: { name: string } | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DEFAULT_APP_URL = "https://app.onbuuk.com";

/** Frontend page that previews and approves the booking (see ApproveBooking.tsx). */
export function approvalUrl(token: string): string {
  const base = (Deno.env.get("APP_PUBLIC_URL") ?? DEFAULT_APP_URL).replace(/\/$/, "");
  return `${base}/approve-booking?token=${encodeURIComponent(token)}`;
}

async function merchantEmails(supabase: SupabaseClient, businessId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("admin_users")
    .select("email, role")
    .eq("business_id", businessId)
    .eq("is_active", true);
  if (error) throw new Error(`admin lookup failed: ${error.message}`);
  const rows = (data ?? []) as { email: string | null; role: string | null }[];
  const preferred = rows.filter((r) => r.email && MERCHANT_ROLES.includes(r.role ?? ""));
  const pool = preferred.length ? preferred : rows.filter((r) => r.email);
  return [...new Set(pool.map((r) => r.email as string))];
}

function buildEmail(details: BookingDetails, args: NotifyArgs): { subject: string; body: string } {
  const isPending = args.status === "pending";
  const when = `${details.booking_date} at ${details.start_time.slice(0, 5)}`;
  const service = details.services?.name ?? "Appointment";
  const customer = details.customer_name ?? "A customer";
  const subject = isPending
    ? `Please approve: ${service} on ${when}`
    : `New booking via AI assistant: ${service} on ${when}`;

  const lines = [
    `<p><strong>${escapeHtml(customer)}</strong> booked through an AI assistant (${escapeHtml(args.agentName)}).</p>`,
    "<ul>",
    `<li>Service: ${escapeHtml(service)}</li>`,
    `<li>When: ${escapeHtml(when)}</li>`,
    details.specialists?.name ? `<li>With: ${escapeHtml(details.specialists.name)}</li>` : "",
    details.customer_phone ? `<li>Phone: ${escapeHtml(details.customer_phone)}</li>` : "",
    details.customer_email ? `<li>Email: ${escapeHtml(details.customer_email)}</li>` : "",
    "</ul>",
  ];
  if (isPending && args.approvalToken) {
    const url = approvalUrl(args.approvalToken);
    lines.push(
      `<p><a href="${url}" style="display:inline-block;padding:14px 28px;background:#1c1917;color:#fff;border-radius:10px;text-decoration:none;font-size:18px">Approve or decline</a></p>`,
    );
  } else {
    lines.push("<p>It is already confirmed in your calendar. Nothing else to do.</p>");
  }
  return { subject, body: lines.filter(Boolean).join("\n") };
}

export async function notifyMerchantOfAgentBooking(
  supabase: SupabaseClient,
  args: NotifyArgs,
): Promise<void> {
  try {
    const { data: details, error } = await supabase
      .from("bookings")
      .select("booking_date, start_time, customer_name, customer_email, customer_phone, services(name), specialists(name)")
      .eq("id", args.bookingId)
      .maybeSingle();
    if (error || !details) throw new Error(`booking lookup failed: ${error?.message ?? "not found"}`);

    const recipients = await merchantEmails(supabase, args.businessId);
    if (!recipients.length) {
      console.error(`agentNotify: no merchant email for business ${args.businessId}`);
      return;
    }

    const { subject, body } = buildEmail(details as unknown as BookingDetails, args);
    for (const toEmail of recipients) {
      const { error: sendError } = await supabase.functions.invoke("send-customer-email", {
        body: { businessId: args.businessId, toEmail, subject, body },
      });
      if (sendError) console.error(`agentNotify: send to ${toEmail} failed`, sendError);
    }
  } catch (err) {
    console.error("agentNotify: failed", err);
  }
}
