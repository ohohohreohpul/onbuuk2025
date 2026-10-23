// Loads what a promotion email shows: shop details, brand colours and the shop's
// current voucher cards. Shared by the send-marketing edge function and the admin
// live preview, so both render the same email. Works with any supabase-js client.

import type { MarketingBlock, MarketingContent, MarketingLanguage, MarketingShop, MarketingVoucher } from "./marketingEmail.ts";

// deno-lint-ignore no-explicit-any
type Client = { from: (table: string) => any };

/** Query parameters the voucher page reads to open a card directly (see GiftCardPurchase). */
export const GIFT_LINK_PARAMS = { open: "gutschein", pass: "karte", set: "set" } as const;

export interface CampaignRow {
  subject: string;
  blocks?: MarketingBlock[] | null;
  body: string;
  button_text: string | null;
  button_url: string | null;
  logo_url?: string | null;
  headline?: string | null;
  hero_image_url?: string | null;
  hero_caption?: string | null;
  offer_enabled?: boolean;
  offer_title?: string | null;
  offer_text?: string | null;
  offer_image_url?: string | null;
  offer_price_cents?: number | null;
  offer_compare_cents?: number | null;
  offer_button_text?: string | null;
  offer_button_url?: string | null;
  vouchers_enabled?: boolean;
  vouchers_title?: string | null;
  closing?: string | null;
}

const SHOP_BASE_DOMAIN = "zennohq.com";
const DAYS_PER_YEAR = 365;

const VALIDITY: Record<MarketingLanguage, { year: string; years: string; days: string }> = {
  de: { year: "1 Jahr gültig", years: "{n} Jahre gültig", days: "{n} Tage gültig" },
  en: { year: "valid 1 year", years: "valid {n} years", days: "valid {n} days" },
  th: { year: "ใช้ได้ 1 ปี", years: "ใช้ได้ {n} ปี", days: "ใช้ได้ {n} วัน" },
};

/** "3 Jahre gültig" for whole years, else "200 Tage gültig". */
const validity = (days: number | null | undefined, language: MarketingLanguage): string | null => {
  if (!days) return null;
  const text = VALIDITY[language];
  if (days === DAYS_PER_YEAR) return text.year;
  return days % DAYS_PER_YEAR === 0 ? text.years.replace("{n}", String(days / DAYS_PER_YEAR)) : text.days.replace("{n}", String(days));
};
const MAX_VOUCHERS = 6;

const BLOCK_TYPES = new Set(["hero", "heading", "text", "image", "button", "offer", "vouchers", "divider"]);
const MAX_BLOCKS = 30;

/** The stored blocks; campaigns from before the block editor are converted from their fields. */
export function campaignToContent(row: CampaignRow): MarketingContent {
  if (Array.isArray(row.blocks) && row.blocks.length > 0) {
    return {
      subject: row.subject,
      blocks: row.blocks.filter((block) => block && BLOCK_TYPES.has(block.type)).slice(0, MAX_BLOCKS),
    };
  }
  const blocks: MarketingBlock[] = [];
  if (row.headline || row.hero_image_url || row.logo_url) {
    blocks.push({
      type: "hero", logoUrl: row.logo_url ?? null, imageUrl: row.hero_image_url ?? null, headline: row.headline ?? null,
      buttonText: row.button_text, buttonUrl: row.button_url, caption: row.hero_caption ?? null,
    });
  }
  if (row.body?.trim()) blocks.push({ type: "text", text: row.body });
  if (!row.headline && row.button_text && row.button_url) blocks.push({ type: "button", text: row.button_text, url: row.button_url });
  if (row.offer_enabled && row.offer_title) {
    blocks.push({
      type: "offer", title: row.offer_title, text: row.offer_text ?? null, imageUrl: row.offer_image_url ?? null,
      priceCents: row.offer_price_cents ?? null, compareCents: row.offer_compare_cents ?? null,
      buttonText: row.offer_button_text ?? null, buttonUrl: row.offer_button_url ?? null,
    });
  }
  if (row.vouchers_enabled !== false) blocks.push({ type: "vouchers", title: row.vouchers_title ?? null, showImages: false });
  if (row.closing?.trim()) blocks.push({ type: "text", text: row.closing });
  return { subject: row.subject, blocks };
}

export async function loadMarketingShop(supabase: Client, businessId: string): Promise<MarketingShop> {
  const [businessRes, colorsRes, domainRes] = await Promise.all([
    supabase.from("businesses").select("name, address, phone, custom_logo_url, language, permalink, hide_powered_by_badge").eq("id", businessId).single(),
    supabase.from("booking_form_colors").select("color_key, color_value").eq("business_id", businessId).in("color_key", ["primary", "secondary"]),
    supabase.from("custom_domains").select("domain").eq("business_id", businessId).eq("status", "verified").limit(1).maybeSingle(),
  ]);
  const business = businessRes.data;
  if (businessRes.error || !business) throw new Error(`Shop ${businessId} not found`);
  const colors = new Map<string, string>(((colorsRes.data ?? []) as { color_key: string; color_value: string }[]).map((c) => [c.color_key, c.color_value]));
  const language: MarketingLanguage = business.language === "en" || business.language === "th" ? business.language : "de";
  const host = domainRes.data?.domain ?? (business.permalink ? `${business.permalink}.${SHOP_BASE_DOMAIN}` : null);
  return {
    name: business.name ?? "",
    address: business.address ?? null,
    phone: business.phone ?? null,
    logoUrl: business.custom_logo_url ?? null,
    primaryColor: colors.get("primary") ?? null,
    accentColor: colors.get("secondary") ?? null,
    language,
    shopUrl: host ? `https://${host}` : null,
    showZennoBadge: !business.hide_powered_by_badge,
  };
}

const giftLink = (shopUrl: string, param: string, id: string) =>
  `${shopUrl}/?${GIFT_LINK_PARAMS.open}=1&${param}=${encodeURIComponent(id)}`;

/** Active voucher sets first, then multi-visit cards; at most six. */
export async function loadShopVouchers(supabase: Client, businessId: string, shop: Pick<MarketingShop, "shopUrl" | "language">): Promise<MarketingVoucher[]> {
  const { shopUrl, language } = shop;
  if (!shopUrl) return [];
  const now = new Date().toISOString();
  const [packagesRes, passesRes] = await Promise.all([
    supabase.from("gift_card_packages").select("id, name, subtitle, price_cents, compare_at_cents, valid_from, valid_until, stock_limit, sold_count")
      .eq("business_id", businessId).eq("is_active", true).order("display_order"),
    supabase.from("service_pass_offers").select("id, name, visit_count, price_cents, expiry_days, services(name, image_url), service_durations(duration_minutes, price_cents)")
      .eq("business_id", businessId).eq("is_active", true).order("created_at"),
  ]);
  // deno-lint-ignore no-explicit-any
  const one = (value: any) => (Array.isArray(value) ? value[0] : value) ?? null;

  // deno-lint-ignore no-explicit-any
  const sets: MarketingVoucher[] = ((packagesRes.data ?? []) as any[])
    .filter((p) => (!p.valid_from || p.valid_from <= now) && (!p.valid_until || p.valid_until > now)
      && (p.stock_limit === null || p.sold_count < p.stock_limit))
    .map((p) => ({
      name: p.name, detail: p.subtitle ?? null, priceCents: p.price_cents, compareCents: p.compare_at_cents ?? null,
      url: giftLink(shopUrl, GIFT_LINK_PARAMS.set, p.id),
      kind: "set" as const, id: p.id,
    }));

  // deno-lint-ignore no-explicit-any
  const passes: MarketingVoucher[] = ((passesRes.data ?? []) as any[]).map((o) => {
    const service = one(o.services);
    const duration = one(o.service_durations);
    const regular = duration?.price_cents ? duration.price_cents * o.visit_count : null;
    return {
      name: o.name,
      detail: duration ? [`${o.visit_count} × ${duration.duration_minutes} Min`, validity(o.expiry_days, language)].filter(Boolean).join(" · ") : null,
      priceCents: o.price_cents,
      compareCents: regular,
      url: giftLink(shopUrl, GIFT_LINK_PARAMS.pass, o.id),
      kind: "pass" as const, id: o.id,
      imageUrl: service?.image_url?.startsWith("https://") ? service.image_url : null,
    };
  });

  return [...sets, ...passes].slice(0, MAX_VOUCHERS);
}
