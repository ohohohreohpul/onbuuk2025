/**
 * Google Business Profile I/O for local SEO: Zernio calls plus the gbp_* mirror
 * tables. Shared by local-seo-admin (owner actions), local-seo-sync (cron) and
 * social-webhook (review events). Every function takes the shop's business id and
 * only touches that shop's Google account.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { complete, isLlmConfigured } from "../receptionist/llm.ts";
import { loadMarketingShop, loadShopVouchers } from "../marketingData.ts";
import { zernio } from "./zernioClient.ts";
import {
  buildPostMessages, buildReplyMessages, cleanAiText, isAutoReplyEligible, MAX_POST_LENGTH, MAX_REPLY_LENGTH,
  parseGbpReview, toGbpHours, toGbpServices, type GbpReview, type PostTopic, type ShopVoice, type WorkingHourRow,
} from "./gbp.ts";

const REVIEW_PAGE_SIZE = "50";
const REVIEW_PAGES = 2;
/** Auto-replies per refresh, so one request stays well inside the edge timeout. */
export const AUTO_REPLY_BATCH = 5;

/** Owner-facing problems: no Google account, no AI credits, AI not configured. */
export class GbpActionError extends Error {
  constructor(message: string, readonly code: "no_account" | "no_credits" | "ai_unavailable") {
    super(message);
  }
}

export interface GbpAccount {
  accountId: string;
  reviewUrl: string | null;
  category: string | null;
}

export interface GbpSettingsRow {
  business_id: string;
  auto_reply_positive: boolean;
  auto_reply_since: string | null;
  sync_hours: boolean;
  sync_services: boolean;
}

/** The shop's connected Google location (one per shop). */
export async function gbpAccount(supabase: SupabaseClient, businessId: string): Promise<GbpAccount | null> {
  const { data, error } = await supabase.from("social_accounts").select("zernio_account_id, review_url, location_category")
    .eq("business_id", businessId).eq("platform", "googlebusiness").eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`google account lookup failed: ${error.message}`);
  return data ? { accountId: data.zernio_account_id, reviewUrl: data.review_url, category: data.location_category } : null;
}

export async function requireGbpAccount(supabase: SupabaseClient, businessId: string): Promise<GbpAccount> {
  const account = await gbpAccount(supabase, businessId);
  if (!account) throw new GbpActionError("Connect your Google Business Profile first.", "no_account");
  return account;
}

export async function loadGbpSettings(supabase: SupabaseClient, businessId: string): Promise<GbpSettingsRow> {
  const { data, error } = await supabase.from("gbp_settings").select("business_id, auto_reply_positive, auto_reply_since, sync_hours, sync_services")
    .eq("business_id", businessId).maybeSingle();
  if (error) throw new Error(`gbp settings lookup failed: ${error.message}`);
  return data ?? { business_id: businessId, auto_reply_positive: false, auto_reply_since: null, sync_hours: true, sync_services: true };
}

const httpsOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.startsWith("https://") && value.length <= 2000 ? value : null;

/** Reads the listing's review link, Maps link and category into social_accounts. */
export async function refreshLocation(supabase: SupabaseClient, businessId: string, accountId: string): Promise<void> {
  const details = await zernio<{
    location?: { reviewUrl?: string | null; mapsUri?: string | null };
    categories?: { primaryCategory?: { name?: string } };
  }>(`/accounts/${encodeURIComponent(accountId)}/gmb-location-details`, { query: { readMask: "title,categories" } });
  const category = details.categories?.primaryCategory?.name?.slice(0, 200) ?? null;
  const { error } = await supabase.from("social_accounts").update({
    review_url: httpsOrNull(details.location?.reviewUrl),
    maps_url: httpsOrNull(details.location?.mapsUri),
    location_category: category,
    updated_at: new Date().toISOString(),
  }).eq("business_id", businessId).eq("zernio_account_id", accountId);
  if (error) throw new Error(`could not store google location: ${error.message}`);
}

// --- Reviews ---------------------------------------------------------------

export interface ReviewRow {
  id: string;
  account_id: string;
  review_id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string;
  reviewed_at: string | null;
  reply_text: string | null;
  reply_source: string | null;
  draft_text: string | null;
}

/**
 * Inserts or refreshes one review; the owner's AI draft is kept until a reply exists.
 * A reply Zenno just posted is never cleared by a listing that does not show it yet;
 * only a reply that came from Google itself disappears when Google drops it.
 */
export async function upsertReview(supabase: SupabaseClient, businessId: string, accountId: string, review: GbpReview): Promise<ReviewRow> {
  const columns = "id, account_id, review_id, reviewer_name, rating, comment, reviewed_at, reply_text, reply_source, draft_text";
  const { data, error } = await supabase.from("gbp_reviews").upsert({
    business_id: businessId,
    account_id: accountId,
    review_id: review.reviewId,
    reviewer_name: review.reviewerName,
    rating: review.rating,
    comment: review.comment,
    reviewed_at: review.createdAt,
    ...(review.replyText ? { reply_text: review.replyText, replied_at: review.repliedAt ?? new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: "account_id,review_id" }).select(columns).single();
  if (error) throw new Error(`could not store review: ${error.message}`);
  if (review.replyText) {
    // A reply written in Google itself counts as answered.
    await supabase.from("gbp_reviews").update({ reply_source: "google" }).eq("id", data.id).is("reply_source", null);
    return data as ReviewRow;
  }
  if (!data.reply_text) return data as ReviewRow;
  const { data: cleared } = await supabase.from("gbp_reviews").update({ reply_text: null, replied_at: null, reply_source: null })
    .eq("id", data.id).eq("reply_source", "google").select(columns).maybeSingle();
  return (cleared ?? data) as ReviewRow;
}

/** Pulls the newest reviews (up to 100) from Google into gbp_reviews. Returns the rows that are unanswered. */
export async function syncReviews(supabase: SupabaseClient, businessId: string, accountId: string): Promise<ReviewRow[]> {
  const unanswered: ReviewRow[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < REVIEW_PAGES; page++) {
    const result: { reviews?: unknown[]; nextPageToken?: string | null } = await zernio(
      `/accounts/${encodeURIComponent(accountId)}/gmb-reviews`,
      { query: { pageSize: REVIEW_PAGE_SIZE, ...(pageToken ? { pageToken } : {}) } },
    );
    for (const raw of result.reviews ?? []) {
      const review = parseGbpReview(raw);
      if (!review) continue;
      const row = await upsertReview(supabase, businessId, accountId, review);
      if (!row.reply_text) unanswered.push(row);
    }
    pageToken = result.nextPageToken ?? null;
    if (!pageToken) break;
  }
  return unanswered;
}

export async function loadVoice(supabase: SupabaseClient, businessId: string): Promise<ShopVoice> {
  const [shop, settingsRes] = await Promise.all([
    loadMarketingShop(supabase, businessId),
    supabase.from("receptionist_settings").select("instructions, address_form").eq("business_id", businessId).maybeSingle(),
  ]);
  return {
    shopName: shop.name,
    language: shop.language,
    addressForm: settingsRes.data?.address_form === "du" ? "du" : "sie",
    instructions: String(settingsRes.data?.instructions ?? ""),
  };
}

/** One AI credit, then the model's text. Throws GbpActionError when the shop is out of credits. */
async function aiText(supabase: SupabaseClient, businessId: string, messages: Parameters<typeof complete>[0], maxLength: number): Promise<string> {
  if (!isLlmConfigured()) throw new GbpActionError("AI drafting is not available right now.", "ai_unavailable");
  const { data: credit, error } = await supabase.rpc("consume_ai_reply", { p_business_id: businessId });
  if (error) throw new Error(`AI credit check failed: ${error.message}`);
  if (credit !== "ok") {
    throw new GbpActionError(credit === "free_plan" ? "AI drafts are part of the paid plans." : "No AI credits left this month. You can buy more under Billing.", "no_credits");
  }
  try {
    const result = await complete(messages, []);
    const text = cleanAiText(result.message.content ?? "", maxLength);
    if (!text) throw new Error("the model returned an empty text");
    return text;
  } catch (error) {
    // No text, no charge.
    const { error: refundError } = await supabase.rpc("refund_ai_reply", { p_business_id: businessId });
    if (refundError) console.error("AI credit refund failed:", refundError);
    throw error;
  }
}

/** AI reply draft in the shop's voice, stored on the review for the owner to approve. */
export async function draftReply(supabase: SupabaseClient, businessId: string, review: ReviewRow): Promise<string> {
  const voice = await loadVoice(supabase, businessId);
  const text = await aiText(supabase, businessId, buildReplyMessages(voice, {
    reviewerName: review.reviewer_name, rating: review.rating, comment: review.comment,
  }), MAX_REPLY_LENGTH);
  const { error } = await supabase.from("gbp_reviews").update({ draft_text: text, drafted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", review.id).eq("business_id", businessId);
  if (error) throw new Error(`could not store draft: ${error.message}`);
  return text;
}

/** Publishes the reply on Google (overwrites an earlier one) and records it. */
export async function publishReply(supabase: SupabaseClient, businessId: string, review: ReviewRow, text: string, source: "owner" | "auto"): Promise<void> {
  try {
    await zernio(`/accounts/${encodeURIComponent(review.account_id)}/gmb-reviews/${encodeURIComponent(review.review_id)}/reply`, {
      method: "POST", body: { comment: text },
    });
  } catch (error) {
    await supabase.from("gbp_reviews").update({ last_error: String(error instanceof Error ? error.message : error).slice(0, 500) }).eq("id", review.id);
    throw error;
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("gbp_reviews").update({
    reply_text: text, replied_at: now, reply_source: source, draft_text: null, last_error: null, updated_at: now,
  }).eq("id", review.id).eq("business_id", businessId);
  if (error) throw new Error(`reply was posted but not recorded: ${error.message}`);
}

/**
 * Auto-reply for 4–5 stars written after the shop switched it on. The review is
 * claimed first (reply_source 'auto'), so a webhook and a refresh never both answer
 * it. Never throws: a review that could not be answered goes back to the owner's
 * inbox with last_error set and is not retried automatically.
 */
export async function autoReplyIfEligible(supabase: SupabaseClient, businessId: string, review: ReviewRow, settings: GbpSettingsRow): Promise<boolean> {
  if (!isAutoReplyEligible({ rating: review.rating, replyText: review.reply_text }, settings.auto_reply_positive)) return false;
  if (review.reply_source !== null || !settings.auto_reply_since) return false;
  if (!review.reviewed_at || Date.parse(review.reviewed_at) < Date.parse(settings.auto_reply_since)) return false;
  const { data: claimed } = await supabase.from("gbp_reviews").update({ reply_source: "auto", updated_at: new Date().toISOString() })
    .eq("id", review.id).eq("business_id", businessId).is("reply_text", null).is("reply_source", null).select("id").maybeSingle();
  if (!claimed) return false;
  try {
    const text = review.draft_text ?? await draftReply(supabase, businessId, review);
    await publishReply(supabase, businessId, review, text, "auto");
    return true;
  } catch (error) {
    console.error(`gbp auto-reply for review ${review.id} failed:`, error);
    await supabase.from("gbp_reviews").update({
      reply_source: "owner", // parked for the owner; the claim check above stops retries
      last_error: String(error instanceof Error ? error.message : error).slice(0, 500),
    }).eq("id", review.id).is("reply_text", null);
    return false;
  }
}

// --- Posts -----------------------------------------------------------------

const euro = (cents: number) => `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: cents % 100 ? 2 : 0 })} €`;

/** What a weekly post can be about: services, current offers and gift cards. */
export async function postTopics(supabase: SupabaseClient, businessId: string): Promise<PostTopic[]> {
  const [servicesRes, shop] = await Promise.all([
    supabase.from("services").select("name, description, is_hidden, service_durations(duration_minutes, price_cents)")
      .eq("business_id", businessId).order("display_order"),
    loadMarketingShop(supabase, businessId),
  ]);
  if (servicesRes.error) throw new Error(`services lookup failed: ${servicesRes.error.message}`);
  type ServiceRow = { name: string; description: string | null; is_hidden: boolean | null; service_durations: { duration_minutes: number; price_cents: number }[] };
  const services: PostTopic[] = ((servicesRes.data ?? []) as ServiceRow[]).filter((s) => !s.is_hidden).map((s) => ({
    kind: "service",
    title: s.name,
    details: [s.description?.slice(0, 300), ...(s.service_durations ?? []).map((d) => `${d.duration_minutes} min · ${euro(d.price_cents)}`)].filter(Boolean).join("\n"),
  }));
  const vouchers: PostTopic[] = (await loadShopVouchers(supabase, businessId, shop).catch(() => [])).map((v) => ({
    kind: v.kind === "set" ? "offer" : "gift_card",
    title: v.name,
    details: [v.detail, euro(v.priceCents)].filter(Boolean).join(" · "),
  }));
  const giftCard: PostTopic = { kind: "gift_card", title: `${shop.name} gift card`, details: "Any amount, redeemable for all services." };
  return [...services, ...vouchers, giftCard];
}

export async function draftPostText(supabase: SupabaseClient, businessId: string, topic: PostTopic): Promise<string> {
  const voice = await loadVoice(supabase, businessId);
  return aiText(supabase, businessId, buildPostMessages(voice, topic), MAX_POST_LENGTH);
}

// --- Profile sync ----------------------------------------------------------

/** Pushes opening hours and/or the service list to Google. */
export async function pushProfile(supabase: SupabaseClient, businessId: string, settings: GbpSettingsRow): Promise<void> {
  const account = await requireGbpAccount(supabase, businessId);
  const path = `/accounts/${encodeURIComponent(account.accountId)}`;

  if (settings.sync_hours) {
    const { data, error } = await supabase.from("working_hours")
      .select("day_of_week, start_time, end_time, is_available, specialists!inner(is_active)")
      .eq("business_id", businessId).eq("specialists.is_active", true);
    if (error) throw new Error(`working hours lookup failed: ${error.message}`);
    const periods = toGbpHours((data ?? []) as WorkingHourRow[]);
    // Google rejects an empty week; a shop without any hours keeps what Google has.
    if (periods.length) {
      await zernio(`${path}/gmb-location-details`, { method: "PUT", body: { updateMask: "regularHours", regularHours: { periods } } });
    }
  }

  if (settings.sync_services) {
    let category = account.category;
    if (!category) {
      await refreshLocation(supabase, businessId, account.accountId);
      category = (await gbpAccount(supabase, businessId))?.category ?? null;
    }
    const { data, error } = await supabase.from("services").select("name, description, is_hidden, service_durations(price_cents)")
      .eq("business_id", businessId).order("display_order");
    if (error) throw new Error(`services lookup failed: ${error.message}`);
    type Row = { name: string; description: string | null; is_hidden: boolean | null; service_durations: { price_cents: number }[] };
    const shop = await loadMarketingShop(supabase, businessId);
    const items = toGbpServices(((data ?? []) as Row[]).map((s) => ({
      name: s.name, description: s.description, is_hidden: s.is_hidden, prices: (s.service_durations ?? []).map((d) => d.price_cents),
    })), category ?? "", shop.language);
    if (items.length) await zernio(`${path}/gmb-services`, { method: "PUT", body: { serviceItems: items } });
  }
}
