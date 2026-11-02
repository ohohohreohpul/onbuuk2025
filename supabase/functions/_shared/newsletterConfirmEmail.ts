/**
 * Double opt-in email ("Bitte bestätigen Sie Ihre Anmeldung"), queued by the
 * bookings trigger when a customer ticks the newsletter box (outbox event
 * newsletter_confirm). Plain and in the shop's name only.
 */
import { escapeHtml } from "./marketingEmail.ts";

export type NewsletterLanguage = "de" | "en" | "th";

const TEXT: Record<NewsletterLanguage, { subject: string; greeting: string; body: string; button: string; ignore: string }> = {
  de: {
    subject: "Bitte bestätigen Sie Ihre Anmeldung bei {shop}",
    greeting: "Hallo {name},",
    body: "Sie möchten Neuigkeiten und Angebote von {shop} per E-Mail erhalten. Bitte bestätigen Sie das mit einem Klick.",
    button: "Anmeldung bestätigen",
    ignore: "Sie haben das nicht angefordert? Dann ignorieren Sie diese E-Mail einfach. Sie erhalten keine Werbung.",
  },
  en: {
    subject: "Please confirm your subscription to {shop}",
    greeting: "Hello {name},",
    body: "You asked to receive news and offers from {shop} by email. Please confirm with one click.",
    button: "Confirm subscription",
    ignore: "Didn't ask for this? Just ignore this email and you won't receive any offers.",
  },
  th: {
    subject: "กรุณายืนยันการสมัครรับข่าวสารจาก {shop}",
    greeting: "สวัสดีคุณ {name}",
    body: "คุณต้องการรับข่าวสารและข้อเสนอจาก {shop} ทางอีเมล กรุณากดยืนยัน",
    button: "ยืนยันการสมัคร",
    ignore: "หากคุณไม่ได้ขอรับ ไม่ต้องทำอะไร คุณจะไม่ได้รับอีเมลโปรโมชัน",
  },
};

export function renderNewsletterConfirmEmail(
  language: NewsletterLanguage,
  shopName: string,
  customerName: string,
  confirmUrl: string,
): { subject: string; html: string } {
  const text = TEXT[language] ?? TEXT.de;
  const fill = (value: string) => value.replace("{shop}", shopName).replace("{name}", customerName);
  const firstName = customerName.trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? escapeHtml(text.greeting.replace("{name}", firstName)) : "";
  const html = `<!doctype html><html lang="${language}"><body style="margin:0;background:#f5f3f0;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
${greeting ? `<p style="margin:0 0 14px;font-size:16px;line-height:1.6">${greeting}</p>` : ""}
<p style="margin:0 0 24px;font-size:16px;line-height:1.6">${escapeHtml(fill(text.body))}</p>
<p style="margin:0 0 28px"><a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:#1a1714;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 24px;font-size:15px">${escapeHtml(text.button)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#78716c">${escapeHtml(text.ignore)}</p>
</div></body></html>`;
  return { subject: fill(text.subject), html };
}
