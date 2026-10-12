/**
 * Sends queued booking emails (private.notification_outbox, filled by the
 * bookings trigger). Called every minute by pg_cron with the shared secret
 * OUTBOX_CRON_SECRET, or by another edge function with the service role.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { merchantEmails } from "../_shared/agentNotify.ts";
import { loadBookingEmailData, type BookingEmailData } from "../_shared/bookingEmailData.ts";
import { fillTemplate, OWNER_EVENTS, renderBuiltIn, type NotificationEvent } from "../_shared/bookingEmailTemplates.ts";
import { isServiceRoleRequest } from "../_shared/emailAccess.ts";
import { decideSend } from "../_shared/notificationRules.ts";

const BATCH_SIZE = 25;
const STATUS_LABEL = {
  de: { pending: "wartet auf Ihre Bestätigung", confirmed: "bestätigt" },
  en: { pending: "waiting for your confirmation", confirmed: "confirmed" },
} as const;

interface ClaimedRow {
  id: string;
  business_id: string;
  booking_id: string;
  event_key: NotificationEvent;
  booking_date: string;
  start_time: string;
  attempts: number;
}

type Outcome = "sent" | "skipped" | "retry";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("OUTBOX_CRON_SECRET") ?? "";
  const given = req.headers.get("x-cron-secret") ?? "";
  return (secret.length >= 32 && timingSafeEqual(given, secret)) || isServiceRoleRequest(req);
}

async function renderEmail(
  supabase: SupabaseClient,
  event: NotificationEvent,
  data: BookingEmailData,
): Promise<{ subject: string; html: string }> {
  const label = STATUS_LABEL[data.language][data.status as "pending" | "confirmed"] ?? data.status;
  const variables = { ...data.variables, booking_status: label };

  if (!OWNER_EVENTS.includes(event)) {
    const { data: custom } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("business_id", data.businessId)
      .eq("event_key", event)
      .eq("is_enabled", true)
      .maybeSingle();
    if (custom?.subject && custom?.body) {
      return { subject: fillTemplate(custom.subject, variables), html: fillTemplate(custom.body, variables) };
    }
  }
  return renderBuiltIn(event, data.language, variables);
}

async function deliver(supabase: SupabaseClient, row: ClaimedRow): Promise<{ outcome: Outcome; note?: string }> {
  const data = await loadBookingEmailData(supabase, row.booking_id);
  const decision = decideSend(
    { event: row.event_key, bookingDate: row.booking_date, startTime: row.start_time },
    data && { status: data.status, bookingDate: data.bookingDate, startTime: data.startTime },
  );
  if (!decision.send || !data) return { outcome: "skipped", note: decision.send ? "booking deleted" : decision.reason };

  const { data: sender } = await supabase
    .from("email_settings")
    .select("id")
    .eq("business_id", row.business_id)
    .maybeSingle();
  if (!sender) return { outcome: "skipped", note: "shop has no email sender configured" };

  const recipients = OWNER_EVENTS.includes(row.event_key)
    ? await merchantEmails(supabase, row.business_id)
    : [data.customerEmail].filter(Boolean);
  if (recipients.length === 0) return { outcome: "skipped", note: "no recipient" };

  const { subject, html } = await renderEmail(supabase, row.event_key, data);
  for (const toEmail of recipients) {
    const { data: result, error } = await supabase.functions.invoke("send-customer-email", {
      body: { businessId: row.business_id, toEmail, subject, body: html },
    });
    if (error || !result?.success) {
      return { outcome: "retry", note: error?.message ?? result?.error ?? "send failed" };
    }
  }
  return { outcome: "sent" };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAuthorized(req)) return json({ error: "Not allowed" }, 403);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: claimed, error } = await supabase.rpc("claim_notifications", { p_limit: BATCH_SIZE });
  if (error) {
    console.error("claim_notifications failed:", error);
    return json({ error: "Could not read the email queue" }, 500);
  }

  const summary: Record<Outcome, number> = { sent: 0, skipped: 0, retry: 0 };
  for (const row of (claimed ?? []) as ClaimedRow[]) {
    let result: { outcome: Outcome; note?: string };
    try {
      result = await deliver(supabase, row);
    } catch (deliverError) {
      result = { outcome: "retry", note: deliverError instanceof Error ? deliverError.message : String(deliverError) };
    }
    summary[result.outcome] += 1;
    if (result.outcome === "retry") console.error(`notification ${row.id} (${row.event_key}) failed: ${result.note}`);

    const { error: finishError } = await supabase.rpc("finish_notification", {
      p_id: row.id,
      p_status: result.outcome,
      p_error: result.note ?? null,
    });
    if (finishError) console.error(`finish_notification ${row.id} failed:`, finishError);
  }

  return json({ processed: claimed?.length ?? 0, ...summary });
});
