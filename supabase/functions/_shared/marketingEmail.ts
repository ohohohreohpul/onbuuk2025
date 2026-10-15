// Promotion email HTML: shop branding only (no Zenno), plain text paragraphs,
// optional button, legally required footer with unsubscribe link. Pure: no I/O.

export type MarketingLanguage = "de" | "en" | "th";

export interface MarketingShop {
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  language: MarketingLanguage;
}

export interface MarketingContent {
  subject: string;
  body: string;
  buttonText: string | null;
  buttonUrl: string | null;
}

const FOOTER = {
  de: { why: "Sie erhalten diese E-Mail als Kundin oder Kunde von {shop}.", unsubscribe: "Vom Newsletter abmelden" },
  en: { why: "You are receiving this email as a customer of {shop}.", unsubscribe: "Unsubscribe" },
  th: { why: "คุณได้รับอีเมลนี้ในฐานะลูกค้าของ {shop}", unsubscribe: "ยกเลิกการรับอีเมล" },
} as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** First word of the stored name, for {vorname}; empty when unknown. */
export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Replace {vorname}/{name} and tidy a greeting left without a name ("Hallo ," → "Hallo,"). */
export function personalize(text: string, firstName: string): string {
  return text
    .replace(/\{(vorname|name|first_?name)\}/gi, firstName)
    .replace(/[ \t]+([,!.])/g, "$1");
}

/** Paragraphs separated by blank lines; single line breaks kept. */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function renderMarketingEmail(
  shop: MarketingShop,
  content: MarketingContent,
  firstName: string,
  unsubscribeUrl: string,
): { subject: string; html: string } {
  const color = shop.primaryColor && HEX_COLOR.test(shop.primaryColor) ? shop.primaryColor : "#1A1714";
  const footer = FOOTER[shop.language] ?? FOOTER.de;
  const subject = personalize(content.subject, firstName);
  const header = shop.logoUrl?.startsWith("https://")
    ? `<img src="${escapeHtml(shop.logoUrl)}" alt="${escapeHtml(shop.name)}" style="max-height:56px;max-width:220px">`
    : `<div style="font-size:22px;font-weight:600;color:${color}">${escapeHtml(shop.name)}</div>`;
  const button = content.buttonText && content.buttonUrl?.startsWith("https://")
    ? `<p style="margin:24px 0"><a href="${escapeHtml(content.buttonUrl)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${escapeHtml(content.buttonText)}</a></p>`
    : "";
  const contact = [shop.name, shop.address, shop.phone].filter(Boolean).map((part) => escapeHtml(part as string)).join(" · ");

  const html = `<!doctype html><html lang="${shop.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f5f3f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a1714">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3f0;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="padding-bottom:24px">${header}</td></tr>
<tr><td style="font-size:16px">${textToHtml(personalize(content.body, firstName))}${button}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 8px;font-size:12px;line-height:1.6;color:#7a726a;text-align:center">
${escapeHtml(footer.why.replace("{shop}", shop.name))}<br>${contact}<br>
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#7a726a">${footer.unsubscribe}</a>
</td></tr></table>
</td></tr></table></body></html>`;

  return { subject, html };
}
