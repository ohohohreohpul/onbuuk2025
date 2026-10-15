// Promotion email HTML, shared by the sender (edge function) and the admin live
// preview. Zenno design language: full-bleed photo hero with a dark fade and a
// two-tone headline, Geist type, black/white pill buttons, cream sections, real
// shop photography. Table layout + inline styles for email clients. Pure: no I/O.

export type MarketingLanguage = "de" | "en" | "th";

export interface MarketingShop {
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  language: MarketingLanguage;
  /** Shop website for links, e.g. https://shop.example.de */
  shopUrl: string | null;
  /** Small "Sent with Zenno" line, off when the shop hides the Zenno badge. */
  showZennoBadge?: boolean;
}

export interface MarketingContent {
  subject: string;
  /** Two-tone headline: first line bright, following lines muted. */
  headline?: string | null;
  heroImageUrl?: string | null;
  /** Short line under the hero button, e.g. "3 Jahre gültig · sofort per E-Mail". */
  heroCaption?: string | null;
  body: string;
  buttonText: string | null;
  buttonUrl: string | null;
  offer?: {
    title: string;
    text: string | null;
    imageUrl: string | null;
    priceCents: number | null;
    compareCents: number | null;
    buttonText: string | null;
    buttonUrl: string | null;
  } | null;
  /** Two-tone section headline above the voucher cards. */
  vouchersTitle?: string | null;
  closing?: string | null;
}

export interface MarketingVoucher {
  name: string;
  detail: string | null;
  priceCents: number;
  compareCents: number | null;
  url: string;
  imageUrl?: string | null;
}

const COPY = {
  de: {
    offerLabel: "Angebot des Monats", vouchersLabel: "Gutscheine & Karten", vouchersTitle: "Zum Verschenken.\nOder für sich selbst.",
    instead: "statt {amount}", save: "−{amount}", buy: "Online kaufen", visit: "Website",
    why: "Sie erhalten diese E-Mail als Kundin oder Kunde von {shop}.", unsubscribe: "Abmelden", sentWith: "Gesendet mit Zenno",
  },
  en: {
    offerLabel: "Offer of the month", vouchersLabel: "Gift cards & passes", vouchersTitle: "To give away.\nOr to keep.",
    instead: "instead of {amount}", save: "−{amount}", buy: "Buy online", visit: "Website",
    why: "You are receiving this email as a customer of {shop}.", unsubscribe: "Unsubscribe", sentWith: "Sent with Zenno",
  },
  th: {
    offerLabel: "โปรโมชันประจำเดือน", vouchersLabel: "บัตรของขวัญและบัตรบริการ", vouchersTitle: "มอบเป็นของขวัญ\nหรือเก็บไว้ใช้เอง",
    instead: "จากปกติ {amount}", save: "−{amount}", buy: "ซื้อออนไลน์", visit: "เว็บไซต์",
    why: "คุณได้รับอีเมลนี้ในฐานะลูกค้าของ {shop}", unsubscribe: "ยกเลิกการรับอีเมล", sentWith: "ส่งด้วย Zenno",
  },
} as const;

const LOCALE: Record<MarketingLanguage, string> = { de: "de-DE", en: "en-GB", th: "th-TH" };
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SANS = "Geist,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'Geist Mono',ui-monospace,Menlo,Consolas,monospace";
const INK = "#1A1714";
const MUTED = "#8A817A";
const CREAM = "#F7F5F2";
const LINE = "#E7E2DC";
const MAX_VOUCHERS = 4;

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
export function textToHtml(text: string, color = INK, size = 16): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:${size}px;line-height:1.65;color:${color}">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** "290 €" for whole euros, "29,50 €" otherwise, in the shop's language. */
export function formatEuro(cents: number, language: MarketingLanguage): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(LOCALE[language], {
    style: "currency", currency: "EUR", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
  }).format(cents / 100);
}

const isHttps = (url: string | null | undefined): url is string => Boolean(url && url.startsWith("https://"));

/** First line in `strong`, the rest in `soft`: the Zenno two-tone headline. */
function twoTone(text: string, strong: string, soft: string): string {
  const [first, ...rest] = text.trim().split(/\n+/);
  const tail = rest.join(" ").trim();
  return `${escapeHtml(first)}${tail ? `<br><span style="color:${soft}">${escapeHtml(tail)}</span>` : ""}`;
}

function pill(text: string, url: string, background: string, color: string, border = background): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr><td style="border-radius:999px;background:${background};border:1px solid ${border}">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:15px;font-weight:600;color:${color};text-decoration:none;border-radius:999px">${escapeHtml(text)}&nbsp;&rarr;</a></td></tr></table>`;
}

const label = (text: string, color = MUTED) =>
  `<p style="margin:0 0 14px;font-family:${MONO};font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${color}">${escapeHtml(text)}</p>`;

function priceLine(priceCents: number, compareCents: number | null, language: MarketingLanguage, size: number): string {
  const copy = COPY[language];
  const compare = compareCents !== null && compareCents > priceCents
    ? `&nbsp;&nbsp;<span style="font-size:14px;font-weight:400;color:${MUTED}">${escapeHtml(copy.instead).replace("{amount}", `<span style="text-decoration:line-through">${formatEuro(compareCents, language)}</span>`)}</span>` : "";
  return `<p style="margin:0 0 18px;font-family:${SANS};font-size:${size}px;font-weight:600;letter-spacing:-0.5px;color:${INK}">${formatEuro(priceCents, language)}${compare}</p>`;
}

function renderHero(shop: MarketingShop, content: MarketingContent, firstName: string, dot: string): string {
  const chip = `<span style="display:inline-block;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.28);font-family:${SANS};font-size:12px;font-weight:500;color:#ffffff"><span style="color:${dot}">&#9679;</span>&nbsp;&nbsp;${escapeHtml(shop.name)}</span>`;
  const headline = content.headline?.trim()
    ? `<h1 style="margin:18px 0 0;font-family:${SANS};font-size:40px;line-height:1.08;font-weight:600;letter-spacing:-1.2px;color:#ffffff">${twoTone(personalize(content.headline, firstName), "#ffffff", "rgba(255,255,255,0.58)")}</h1>` : "";
  const cta = content.buttonText && isHttps(content.buttonUrl)
    ? `<div style="margin-top:26px">${pill(content.buttonText, content.buttonUrl, "#ffffff", INK)}</div>` : "";
  const caption = content.heroCaption?.trim()
    ? `<p style="margin:14px 0 0;font-family:${MONO};font-size:11px;letter-spacing:.5px;color:rgba(255,255,255,0.62)">${escapeHtml(content.heroCaption)}</p>` : "";
  const image = isHttps(content.heroImageUrl) ? content.heroImageUrl : null;
  const background = image
    ? `background-color:${INK};background-image:linear-gradient(180deg,rgba(26,23,20,0.05) 0%,rgba(26,23,20,0.35) 45%,rgba(26,23,20,0.88) 100%),url('${escapeHtml(image)}');background-size:cover;background-position:center`
    : `background-color:${INK}`;
  return `<tr><td ${image ? `background="${escapeHtml(image)}" ` : ""}bgcolor="${INK}" style="${background};padding:${image ? "230px" : "56px"} 36px 40px">${chip}${headline}${cta}${caption}</td></tr>`;
}

function renderOffer(offer: NonNullable<MarketingContent["offer"]>, shop: MarketingShop, firstName: string): string {
  const copy = COPY[shop.language];
  const image = isHttps(offer.imageUrl)
    ? `<img src="${escapeHtml(offer.imageUrl)}" width="528" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:18px;margin:0 0 22px">` : "";
  return `<tr><td style="background:${CREAM};padding:44px 36px 40px">
${label(copy.offerLabel)}${image}
<h2 style="margin:0 0 10px;font-family:${SANS};font-size:28px;line-height:1.15;font-weight:600;letter-spacing:-0.8px;color:${INK}">${twoTone(personalize(offer.title, firstName), INK, MUTED)}</h2>
${offer.text ? textToHtml(personalize(offer.text, firstName), MUTED, 15) : ""}
${offer.priceCents !== null ? priceLine(offer.priceCents, offer.compareCents, shop.language, 26) : ""}
${offer.buttonText && isHttps(offer.buttonUrl) ? pill(offer.buttonText, offer.buttonUrl, INK, "#ffffff") : ""}
</td></tr>`;
}

function voucherCard(voucher: MarketingVoucher, language: MarketingLanguage): string {
  const copy = COPY[language];
  const saving = voucher.compareCents !== null && voucher.compareCents > voucher.priceCents ? voucher.compareCents - voucher.priceCents : null;
  const image = isHttps(voucher.imageUrl)
    ? `<a href="${escapeHtml(voucher.url)}"><img src="${escapeHtml(voucher.imageUrl)}" width="252" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:14px;margin:0 0 14px"></a>` : "";
  const badge = saving !== null
    ? `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:${INK};font-family:${SANS};font-size:11px;font-weight:600;color:#ffffff;vertical-align:middle">${escapeHtml(copy.save.replace("{amount}", formatEuro(saving, language)))}</span>` : "";
  return `${image}
<p style="margin:0 0 4px;font-family:${SANS};font-size:16px;line-height:1.3;font-weight:600;letter-spacing:-0.2px;color:${INK}">${escapeHtml(voucher.name)}</p>
${voucher.detail ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:13px;color:${MUTED}">${escapeHtml(voucher.detail)}</p>` : ""}
<p style="margin:0 0 12px;font-family:${SANS};font-size:20px;font-weight:600;letter-spacing:-0.4px;color:${INK}">${formatEuro(voucher.priceCents, language)}${badge}</p>
<a href="${escapeHtml(voucher.url)}" style="font-family:${SANS};font-size:14px;font-weight:600;color:${INK};text-decoration:underline;text-underline-offset:3px">${escapeHtml(copy.buy)}&nbsp;&rarr;</a>`;
}

function renderVouchers(vouchers: MarketingVoucher[], title: string | null, shop: MarketingShop): string {
  const copy = COPY[shop.language];
  const items = vouchers.slice(0, MAX_VOUCHERS);
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const right = items[i + 1];
    rows.push(`<tr>
<td class="col" width="50%" valign="top" style="padding:0 12px 32px 0">${voucherCard(items[i], shop.language)}</td>
<td class="col" width="50%" valign="top" style="padding:0 0 32px 12px">${right ? voucherCard(right, shop.language) : "&nbsp;"}</td>
</tr>`);
  }
  return `<tr><td style="padding:48px 36px 8px">
${label(copy.vouchersLabel)}
<h2 style="margin:0 0 28px;font-family:${SANS};font-size:28px;line-height:1.15;font-weight:600;letter-spacing:-0.8px;color:${INK}">${twoTone(title || copy.vouchersTitle, INK, MUTED)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
</td></tr>`;
}

export function renderMarketingEmail(
  shop: MarketingShop,
  content: MarketingContent,
  firstName: string,
  unsubscribeUrl: string,
  vouchers: MarketingVoucher[] = [],
): { subject: string; html: string } {
  const dot = shop.primaryColor && HEX_COLOR.test(shop.primaryColor) ? shop.primaryColor : "#059669";
  const copy = COPY[shop.language] ?? COPY.de;
  const subject = personalize(content.subject, firstName);
  const intro = content.body.trim()
    ? `<tr><td style="padding:44px 36px 28px">${textToHtml(personalize(content.body, firstName), INK, 17)}</td></tr>` : "";
  const offer = content.offer?.title ? renderOffer(content.offer, shop, firstName) : "";
  const voucherSection = vouchers.length > 0 ? renderVouchers(vouchers, content.vouchersTitle ?? null, shop) : "";
  const closing = content.closing?.trim()
    ? `<tr><td style="padding:8px 36px 44px">${textToHtml(personalize(content.closing, firstName), INK, 16)}</td></tr>` : "";
  const contact = [shop.address, shop.phone].filter(Boolean).map((part) => escapeHtml(part as string)).join("&nbsp;&middot;&nbsp;");
  const links = [
    isHttps(shop.shopUrl) ? `<a href="${escapeHtml(shop.shopUrl)}" style="color:${INK};text-decoration:underline">${copy.visit}</a>` : "",
    `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">${escapeHtml(copy.unsubscribe)}</a>`,
  ].filter(Boolean).join("&nbsp;&nbsp;&middot;&nbsp;&nbsp;");
  const footer = `<tr><td style="background:${CREAM};border-top:1px solid ${LINE};padding:32px 36px 36px">
<p style="margin:0 0 6px;font-family:${SANS};font-size:15px;font-weight:600;color:${INK}">${escapeHtml(shop.name)}</p>
${contact ? `<p style="margin:0 0 14px;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED}">${contact}</p>` : ""}
<p style="margin:0 0 14px;font-family:${SANS};font-size:13px">${links}</p>
<p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:${MUTED}">${escapeHtml(copy.why.replace("{shop}", shop.name))}${shop.showZennoBadge ? `<br><span style="font-family:${MONO}">${escapeHtml(copy.sentWith)}</span>` : ""}</p>
</td></tr>`;

  const html = `<!doctype html><html lang="${shop.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.col{display:block!important;width:100%!important;padding:0 0 32px 0!important}h1{font-size:32px!important}}</style></head>
<body style="margin:0;padding:0;background:#EFEBE6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEBE6"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:28px;overflow:hidden">
${renderHero(shop, content, firstName, dot)}${intro}${offer}${voucherSection}${closing}${footer}
</table></td></tr></table></body></html>`;

  return { subject, html };
}
