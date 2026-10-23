// Promotion email HTML, shared by the sender (edge function) and the admin live
// preview. The shop builds the email from blocks (header, heading, text, image,
// button, offer, voucher cards, divider); the footer with address and unsubscribe
// link is always added. Light and plain: dark text on white, IBM Plex Sans, no
// text over images (unreadable in phone dark modes).
// Table layout + inline styles for email clients. Pure: no I/O.

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

export type ImageSize = "small" | "medium" | "full";

export type MarketingBlock =
  | { type: "hero"; logoUrl?: string | null; imageUrl?: string | null; headline?: string | null; buttonText?: string | null; buttonUrl?: string | null; caption?: string | null }
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; size?: ImageSize; link?: string | null }
  | { type: "button"; text: string; url: string; style?: "dark" | "light" }
  | { type: "offer"; title: string; text?: string | null; imageUrl?: string | null; priceCents?: number | null; compareCents?: number | null; buttonText?: string | null; buttonUrl?: string | null }
  | { type: "vouchers"; title?: string | null; showImages?: boolean }
  | { type: "divider" };

export type MarketingBlockType = MarketingBlock["type"];

export interface MarketingContent {
  subject: string;
  blocks: MarketingBlock[];
}

export interface MarketingVoucher {
  name: string;
  detail: string | null;
  priceCents: number;
  compareCents: number | null;
  url: string;
  imageUrl?: string | null;
  /** Set or multi-visit card, so the website chat can sell exactly this voucher. */
  kind?: "set" | "pass";
  id?: string;
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
// IBM Plex Sans (free, Google Fonts) where the email client loads web fonts; Gmail falls back to Helvetica/Arial.
const SANS = "'IBM Plex Sans','Helvetica Neue',Helvetica,Arial,sans-serif";
const FONT_LINK = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
const INK = "#1A1714";
const MUTED = "#8A817A";
const CREAM = "#F7F5F2";
const LINE = "#E7E2DC";
const MAX_VOUCHERS = 4;
const CONTENT_WIDTH = 528;
const IMAGE_WIDTH: Record<ImageSize, number> = { small: 160, medium: 340, full: CONTENT_WIDTH };
const PAD = "36px";

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

/** First line in `strong`, the rest in `soft`: the two-tone headline. */
function twoTone(text: string, soft: string): string {
  const [first, ...rest] = text.trim().split(/\n+/);
  const tail = rest.join(" ").trim();
  return `${escapeHtml(first)}${tail ? `<br><span style="color:${soft}">${escapeHtml(tail)}</span>` : ""}`;
}

function pill(text: string, url: string, background: string, color: string, border = background): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table"><tr><td style="border-radius:999px;background:${background};border:1px solid ${border}">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:15px;font-weight:600;color:${color};text-decoration:none;border-radius:999px">${escapeHtml(text)}&nbsp;&rarr;</a></td></tr></table>`;
}

const label = (text: string) =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${MUTED}">${escapeHtml(text)}</p>`;

const row = (inner: string, padding = `20px ${PAD}`, background = "#ffffff") =>
  `<tr><td style="background:${background};padding:${padding}">${inner}</td></tr>`;

function heading(text: string, size: number): string {
  return `<h2 style="margin:0;font-family:${SANS};font-size:${size}px;line-height:1.15;font-weight:600;letter-spacing:-0.6px;color:${INK}">${twoTone(text, MUTED)}</h2>`;
}

function priceLine(priceCents: number, compareCents: number | null, language: MarketingLanguage): string {
  const copy = COPY[language];
  const compare = compareCents !== null && compareCents > priceCents
    ? `&nbsp;&nbsp;<span style="font-size:14px;font-weight:400;color:${MUTED}">${escapeHtml(copy.instead).replace("{amount}", `<span style="text-decoration:line-through">${formatEuro(compareCents, language)}</span>`)}</span>` : "";
  return `<p style="margin:0 0 18px;font-family:${SANS};font-size:26px;font-weight:600;letter-spacing:-0.5px;color:${INK}">${formatEuro(priceCents, language)}${compare}</p>`;
}

interface RenderContext {
  shop: MarketingShop;
  firstName: string;
  vouchers: MarketingVoucher[];
}

/**
 * Header: logo, optional photo as a plain image, then headline, button and caption
 * in dark text on white. No text on top of the photo: phone mail apps (dark mode)
 * drop or recolour background images, which made overlaid text unreadable.
 */
function renderHero(block: Extract<MarketingBlock, { type: "hero" }>, ctx: RenderContext): string {
  const { shop, firstName } = ctx;
  const logo = block.logoUrl ?? shop.logoUrl;
  const brand = isHttps(logo)
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(shop.name)}" height="40" style="display:block;height:40px;width:auto;max-width:220px;border:0">`
    : `<p style="margin:0;font-family:${SANS};font-size:15px;font-weight:600;color:${INK}">${escapeHtml(shop.name)}</p>`;
  const photo = isHttps(block.imageUrl)
    ? `<tr><td style="padding:0 ${PAD}"><img src="${escapeHtml(block.imageUrl)}" width="${CONTENT_WIDTH}" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:16px"></td></tr>` : "";
  const headline = block.headline?.trim()
    ? `<h1 style="margin:0;font-family:${SANS};font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.6px;color:${INK}">${twoTone(personalize(block.headline, firstName), MUTED)}</h1>` : "";
  const cta = block.buttonText && isHttps(block.buttonUrl) ? `<div style="margin-top:22px">${pill(block.buttonText, block.buttonUrl, INK, "#ffffff")}</div>` : "";
  const caption = block.caption?.trim()
    ? `<p style="margin:12px 0 0;font-family:${SANS};font-size:13px;color:${MUTED}">${escapeHtml(block.caption)}</p>` : "";
  const text = headline || cta || caption ? `<tr><td style="padding:28px ${PAD} 8px">${headline}${cta}${caption}</td></tr>` : "";
  return `<tr><td style="padding:32px ${PAD} 24px">${brand}</td></tr>${photo}${text}`;
}

function renderImage(block: Extract<MarketingBlock, { type: "image" }>): string {
  if (!isHttps(block.url)) return "";
  const width = IMAGE_WIDTH[block.size ?? "medium"];
  const radius = block.size === "small" ? 8 : 16;
  const img = `<img src="${escapeHtml(block.url)}" width="${width}" alt="" style="display:block;margin:0 auto;width:100%;max-width:${width}px;height:auto;border:0;border-radius:${radius}px">`;
  return row(`<div style="text-align:center">${isHttps(block.link) ? `<a href="${escapeHtml(block.link)}">${img}</a>` : img}</div>`);
}

function renderOffer(block: Extract<MarketingBlock, { type: "offer" }>, ctx: RenderContext): string {
  const copy = COPY[ctx.shop.language];
  const image = isHttps(block.imageUrl)
    ? `<img src="${escapeHtml(block.imageUrl)}" width="${CONTENT_WIDTH}" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:16px;margin:0 0 22px">` : "";
  return row(`${label(copy.offerLabel)}${image}
${heading(personalize(block.title, ctx.firstName), 26)}
<div style="height:10px"></div>
${block.text ? textToHtml(personalize(block.text, ctx.firstName), MUTED, 15) : ""}
${block.priceCents != null ? priceLine(block.priceCents, block.compareCents ?? null, ctx.shop.language) : ""}
${block.buttonText && isHttps(block.buttonUrl) ? pill(block.buttonText, block.buttonUrl, INK, "#ffffff") : ""}`, `40px ${PAD} 40px`, CREAM);
}

function voucherCard(voucher: MarketingVoucher, language: MarketingLanguage, showImage: boolean): string {
  const copy = COPY[language];
  const saving = voucher.compareCents !== null && voucher.compareCents > voucher.priceCents ? voucher.compareCents - voucher.priceCents : null;
  const image = showImage && isHttps(voucher.imageUrl)
    ? `<a href="${escapeHtml(voucher.url)}"><img src="${escapeHtml(voucher.imageUrl)}" width="252" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:12px;margin:0 0 14px"></a>` : "";
  const badge = saving !== null
    ? `<span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:${INK};font-family:${SANS};font-size:11px;font-weight:600;color:#ffffff;vertical-align:middle">${escapeHtml(copy.save.replace("{amount}", formatEuro(saving, language)))}</span>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:16px"><tr><td style="padding:18px">${image}
<p style="margin:0 0 4px;font-family:${SANS};font-size:16px;line-height:1.3;font-weight:600;color:${INK}">${escapeHtml(voucher.name)}</p>
${voucher.detail ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:13px;color:${MUTED}">${escapeHtml(voucher.detail)}</p>` : ""}
<p style="margin:0 0 12px;font-family:${SANS};font-size:20px;font-weight:600;letter-spacing:-0.4px;color:${INK}">${formatEuro(voucher.priceCents, language)}${badge}</p>
<a href="${escapeHtml(voucher.url)}" style="font-family:${SANS};font-size:14px;font-weight:600;color:${INK};text-decoration:underline">${escapeHtml(copy.buy)}&nbsp;&rarr;</a>
</td></tr></table>`;
}

function renderVouchers(block: Extract<MarketingBlock, { type: "vouchers" }>, ctx: RenderContext): string {
  const items = ctx.vouchers.slice(0, MAX_VOUCHERS);
  if (items.length === 0) return "";
  const copy = COPY[ctx.shop.language];
  const showImages = block.showImages === true;
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const right = items[i + 1];
    rows.push(`<tr>
<td class="col" width="50%" valign="top" style="padding:0 8px 16px 0">${voucherCard(items[i], ctx.shop.language, showImages)}</td>
<td class="col" width="50%" valign="top" style="padding:0 0 16px 8px">${right ? voucherCard(right, ctx.shop.language, showImages) : "&nbsp;"}</td>
</tr>`);
  }
  return row(`${label(copy.vouchersLabel)}${heading(block.title?.trim() || copy.vouchersTitle, 26)}
<div style="height:24px"></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`, `32px ${PAD} 16px`);
}

function renderBlock(block: MarketingBlock, ctx: RenderContext): string {
  switch (block.type) {
    case "hero": return renderHero(block, ctx);
    case "heading": return block.text?.trim() ? row(heading(personalize(block.text, ctx.firstName), 26), `28px ${PAD} 4px`) : "";
    case "text": return block.text?.trim() ? row(textToHtml(personalize(block.text, ctx.firstName), INK, 16), `16px ${PAD} 4px`) : "";
    case "image": return renderImage(block);
    case "button": return block.text && isHttps(block.url)
      ? row(block.style === "light" ? pill(block.text, block.url, "#ffffff", INK, LINE) : pill(block.text, block.url, INK, "#ffffff"))
      : "";
    case "offer": return block.title?.trim() ? renderOffer(block, ctx) : "";
    case "vouchers": return renderVouchers(block, ctx);
    case "divider": return row(`<div style="height:1px;background:${LINE};font-size:0;line-height:0">&nbsp;</div>`);
    default: return "";
  }
}

function renderFooter(shop: MarketingShop, unsubscribeUrl: string): string {
  const copy = COPY[shop.language] ?? COPY.de;
  const contact = [shop.address, shop.phone].filter(Boolean).map((part) => escapeHtml(part as string)).join("&nbsp;&middot;&nbsp;");
  const links = [
    isHttps(shop.shopUrl) ? `<a href="${escapeHtml(shop.shopUrl)}" style="color:${INK};text-decoration:underline">${copy.visit}</a>` : "",
    `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline">${escapeHtml(copy.unsubscribe)}</a>`,
  ].filter(Boolean).join("&nbsp;&nbsp;&middot;&nbsp;&nbsp;");
  return `<tr><td style="height:24px;background:#ffffff"></td></tr><tr><td style="background:${CREAM};border-top:1px solid ${LINE};padding:32px ${PAD} 36px">
<p style="margin:0 0 6px;font-family:${SANS};font-size:15px;font-weight:600;color:${INK}">${escapeHtml(shop.name)}</p>
${contact ? `<p style="margin:0 0 14px;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED}">${contact}</p>` : ""}
<p style="margin:0 0 14px;font-family:${SANS};font-size:13px">${links}</p>
<p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.6;color:${MUTED}">${escapeHtml(copy.why.replace("{shop}", shop.name))}${shop.showZennoBadge ? `<br>${escapeHtml(copy.sentWith)}` : ""}</p>
</td></tr>`;
}

export function renderMarketingEmail(
  shop: MarketingShop,
  content: MarketingContent,
  firstName: string,
  unsubscribeUrl: string,
  vouchers: MarketingVoucher[] = [],
): { subject: string; html: string } {
  const accent = shop.primaryColor && HEX_COLOR.test(shop.primaryColor) ? shop.primaryColor : INK;
  const subject = personalize(content.subject, firstName);
  const ctx: RenderContext = { shop, firstName, vouchers };
  const body = content.blocks.map((block) => renderBlock(block, ctx)).join("");
  // Without a header block the email still opens with the shop name in its colour.
  const top = content.blocks[0]?.type === "hero" ? "" : row(`<p style="margin:0;font-family:${SANS};font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${accent}">${escapeHtml(shop.name)}</p>`, `32px ${PAD} 8px`);

  const html = `<!doctype html><html lang="${shop.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<link href="${FONT_LINK}" rel="stylesheet">
<style>@media (max-width:620px){.col{display:block!important;width:100%!important;padding:0 0 16px 0!important}h1{font-size:26px!important}}</style></head>
<body style="margin:0;padding:0;background:#EFEBE6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEBE6"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden">
${top}${body}${renderFooter(shop, unsubscribeUrl)}
</table></td></tr></table></body></html>`;

  return { subject, html };
}
