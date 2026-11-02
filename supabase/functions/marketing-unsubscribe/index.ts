/**
 * Public unsubscribe link for promotion emails (no sign-in).
 *  GET  ?t=<token>  shows a confirmation page in the shop's language.
 *  POST ?t=<token>  one-click unsubscribe (RFC 8058, List-Unsubscribe-Post).
 *  GET  ?a=confirm&t=<token>  double opt-in page with a confirm button
 *  POST ?a=confirm&t=<token>  the button (a GET never confirms: mail scanners open links).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { escapeHtml } from "../_shared/marketingEmail.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEXT = {
  de: { done: "Sie wurden abgemeldet", body: "Sie erhalten keine Angebote von {shop} mehr per E-Mail. Termin- und Gutschein-E-Mails bekommen Sie weiterhin.", invalid: "Dieser Link ist ungültig oder abgelaufen." },
  en: { done: "You have been unsubscribed", body: "You will no longer receive offers from {shop} by email. Appointment and gift card emails still arrive as usual.", invalid: "This link is invalid or has expired." },
  th: { done: "ยกเลิกการรับอีเมลแล้ว", body: "คุณจะไม่ได้รับอีเมลโปรโมชันจาก {shop} อีก แต่ยังได้รับอีเมลเกี่ยวกับการจองและบัตรของขวัญตามปกติ", invalid: "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุแล้ว" },
} as const;

const CONFIRM_TEXT = {
  de: { ask: "Anmeldung bestätigen", askBody: "Möchten Sie Neuigkeiten und Angebote von {shop} per E-Mail erhalten?", done: "Anmeldung bestätigt", body: "Sie erhalten ab jetzt Neuigkeiten und Angebote von {shop}. Abmelden geht jederzeit über den Link in jeder E-Mail.", stale: "Dieser Link ist nicht mehr gültig. Melden Sie sich bei Ihrer nächsten Buchung einfach erneut an." },
  en: { ask: "Confirm subscription", askBody: "Would you like to receive news and offers from {shop} by email?", done: "Subscription confirmed", body: "You will now receive news and offers from {shop}. You can unsubscribe any time with the link in every email.", stale: "This link is no longer valid. Just sign up again with your next booking." },
  th: { ask: "ยืนยันการสมัคร", askBody: "ต้องการรับข่าวสารและข้อเสนอจาก {shop} ทางอีเมลหรือไม่", done: "ยืนยันการสมัครแล้ว", body: "คุณจะได้รับข่าวสารและข้อเสนอจาก {shop} ยกเลิกได้ทุกเมื่อผ่านลิงก์ในทุกอีเมล", stale: "ลิงก์นี้ใช้ไม่ได้แล้ว สมัครใหม่ได้เมื่อจองครั้งถัดไป" },
} as const;

type Lang = keyof typeof TEXT;
const langOf = (value: unknown): Lang => (value === "en" || value === "th" ? value : "de");

function page(title: string, body: string, lang: string, extraHtml = ""): Response {
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f3f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714;padding:16px">
<main style="max-width:440px;background:#fff;border-radius:16px;padding:32px;text-align:center">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="margin:0;line-height:1.6;color:#57534e">${escapeHtml(body)}</p>${extraHtml}</main></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const params = new URL(req.url).searchParams;
  const token = params.get("t") ?? "";
  if (!UUID.test(token)) return page(TEXT.de.invalid, "", "de");

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (params.get("a") === "confirm") {
    const { data, error } = req.method === "POST"
      ? await supabase.rpc("confirm_newsletter", { p_token: token })
      : await supabase.rpc("newsletter_confirm_preview", { p_token: token });
    if (error) {
      console.error("newsletter confirm failed:", error);
      return new Response("Error", { status: 500 });
    }
    const lang = langOf(data?.language);
    if (!data) return page(TEXT[lang].invalid, "", lang);
    const text = CONFIRM_TEXT[lang];
    if (!data.confirmed) return page(text.stale, "", lang);
    if (req.method === "POST") return page(text.done, text.body.replace("{shop}", data.shop ?? ""), lang);
    const button = `<form method="post" style="margin-top:20px"><button type="submit" style="border:0;border-radius:999px;background:#1a1714;color:#fff;padding:12px 24px;font-size:15px;cursor:pointer">${escapeHtml(text.ask)}</button></form>`;
    return page(text.ask, text.askBody.replace("{shop}", data.shop ?? ""), lang, button);
  }

  const { data, error } = await supabase.rpc("marketing_unsubscribe", { p_token: token });
  if (error) {
    console.error("marketing_unsubscribe failed:", error);
    return new Response("Error", { status: 500 });
  }
  if (req.method === "POST") return new Response("OK", { status: 200 });

  const lang = langOf(data?.language);
  if (!data) return page(TEXT[lang].invalid, "", lang);
  return page(TEXT[lang].done, TEXT[lang].body.replace("{shop}", data.shop ?? ""), lang);
});
