import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Private subscription link per specialist: GET /calendar-feed?token=…
// Google/Apple/Outlook poll it and show the specialist's Zenno bookings.
// Events carry only the treatment and the customer's first name.

const TOKEN_PATTERN = /^[0-9a-f]{48}$/;
const PRODUCT_ID = "-//ZennoHQ//Bookings//EN";

interface FeedEvent {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  service_name: string | null;
  customer_first_name: string | null;
  specialist_name: string | null;
  business_name: string | null;
  business_address: string | null;
}

/** RFC 5545 text escaping. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines are at most 75 octets; longer ones continue with a leading space. */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (new TextEncoder().encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildCalendar(events: FeedEvent[]): string {
  const calendarName = events[0]
    ? `${events[0].business_name ?? "Zenno"} · ${events[0].specialist_name ?? ""}`.trim()
    : "Zenno bookings";
  const stamp = toIcsUtc(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const event of events) {
    const title = [event.service_name, event.customer_first_name].filter(Boolean).join(" – ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.booking_id}@zennohq.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(event.starts_at)}`,
      `DTEND:${toIcsUtc(event.ends_at)}`,
      `SUMMARY:${escapeText(title || "Booking")}`,
      ...(event.business_address ? [`LOCATION:${escapeText(event.business_address)}`] : []),
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!TOKEN_PATTERN.test(token)) return new Response("Not found", { status: 404 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.rpc("calendar_feed_events", { p_token: token });
  if (error) {
    console.error("calendar-feed error", error.message);
    return new Response("Calendar unavailable", { status: 500 });
  }

  // An unknown token and a calendar without bookings look the same from outside.
  return new Response(buildCalendar((data ?? []) as FeedEvent[]), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="zenno.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
});
