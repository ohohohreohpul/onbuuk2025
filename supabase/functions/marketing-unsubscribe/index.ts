/**
 * Public unsubscribe link for promotion emails (no sign-in).
 *  GET  ?t=<token>  shows a confirmation page in the shop's language.
 *  POST ?t=<token>  one-click unsubscribe (RFC 8058, List-Unsubscribe-Post).
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

function page(title: string, body: string, lang: string): Response {
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f3f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714;padding:16px">
<main style="max-width:440px;background:#fff;border-radius:16px;padding:32px;text-align:center">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1><p style="margin:0;line-height:1.6;color:#57534e">${escapeHtml(body)}</p></main></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(token)) return page(TEXT.de.invalid, "", "de");

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("marketing_unsubscribe", { p_token: token });
  if (error) {
    console.error("marketing_unsubscribe failed:", error);
    return new Response("Error", { status: 500 });
  }
  if (req.method === "POST") return new Response("OK", { status: 200 });

  const lang = (data?.language === "en" || data?.language === "th" ? data.language : "de") as keyof typeof TEXT;
  if (!data) return page(TEXT[lang].invalid, "", lang);
  return page(TEXT[lang].done, TEXT[lang].body.replace("{shop}", data.shop ?? ""), lang);
});
