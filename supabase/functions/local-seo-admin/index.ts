import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizationErrorResponse, requireActiveAdmin } from "../_shared/adminAuthorization.ts";
import { loadMarketingShop } from "../_shared/marketingData.ts";
import {
  buildPostRequest, GbpInputError, isPostLive, pickPostTopic, readPostDraft, readReplyText, type PostDraft,
} from "../_shared/social/gbp.ts";
import {
  AUTO_REPLY_BATCH, autoReplyIfEligible, draftPostText, draftReply, GbpActionError, gbpAccount, loadGbpSettings, postTopics, publishReply,
  pushProfile, requireGbpAccount, syncReviews, type ReviewRow,
} from "../_shared/social/gbpService.ts";
import { zernio, ZernioError } from "../_shared/social/zernioClient.ts";

// Admin API for local SEO (Google Business Profile, Zenno Social): POST { action, ... }.
//   status                          plan, Google account, settings, last sync
//   reviews / refresh_reviews       list (refresh pulls from Google first, auto-replies 4–5 stars if on)
//   draft_reply {id}                AI draft in the shop's voice (1 AI credit)
//   send_reply {id, text}           publish the owner-approved reply
//   save_settings {...}             auto-reply and profile sync switches
//   sync_now                        push hours + services to Google now
//   posts / draft_post              list / AI draft of this week's post (1 AI credit)
//   save_post {id?, mode, ...}      mode draft | schedule | publish
//   delete_post {id}                drafts, failed, or cancel a scheduled post
// Everything needs business_has_local_seo(); ids from the client are checked against the shop.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MANAGER_ROLES = ["owner", "admin", "manager"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_LIMIT = 100;
const REVIEW_COLUMNS = "id, account_id, review_id, reviewer_name, rating, comment, reviewed_at, reply_text, replied_at, reply_source, draft_text, drafted_at, last_error";
const POST_COLUMNS = "id, content, topic, cta_type, cta_url, status, scheduled_for, published_at, post_url, last_error, created_at";

type Body = Record<string, unknown>;
type Admin = Awaited<ReturnType<typeof requireActiveAdmin>>;

class InputError extends Error {}
class PlanError extends Error {}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const now = () => new Date().toISOString();

async function requireLocalSeo({ supabaseAdmin, businessId }: Admin): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("business_has_local_seo", { p_business_id: businessId });
  if (error) throw new Error(`plan check failed: ${error.message}`);
  if (data !== true) throw new PlanError("Google reviews and posts are part of the Zenno Social plan.");
}

async function ownReview(admin: Admin, id: unknown): Promise<ReviewRow> {
  if (typeof id !== "string" || !UUID.test(id)) throw new InputError("Unknown review.");
  const { data } = await admin.supabaseAdmin.from("gbp_reviews").select(REVIEW_COLUMNS).eq("business_id", admin.businessId).eq("id", id).maybeSingle();
  if (!data) throw new InputError("Unknown review.");
  return data as ReviewRow;
}

async function ownPost(admin: Admin, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new InputError("Unknown post.");
  const { data } = await admin.supabaseAdmin.from("gbp_posts").select(`${POST_COLUMNS}, zernio_post_id`).eq("business_id", admin.businessId).eq("id", id).maybeSingle();
  if (!data) throw new InputError("Unknown post.");
  return data;
}

async function listReviews(admin: Admin) {
  const { data, error } = await admin.supabaseAdmin.from("gbp_reviews").select(REVIEW_COLUMNS)
    .eq("business_id", admin.businessId).order("reviewed_at", { ascending: false, nullsFirst: false }).limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function listPosts(admin: Admin) {
  const { data, error } = await admin.supabaseAdmin.from("gbp_posts").select(POST_COLUMNS)
    .eq("business_id", admin.businessId).order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function status(admin: Admin) {
  const [account, settingsRes, { data: links }] = await Promise.all([
    gbpAccount(admin.supabaseAdmin, admin.businessId),
    admin.supabaseAdmin.from("gbp_settings").select("auto_reply_positive, sync_hours, sync_services, sync_due_at, last_synced_at, last_sync_error")
      .eq("business_id", admin.businessId).maybeSingle(),
    admin.supabaseAdmin.from("social_accounts").select("maps_url").eq("business_id", admin.businessId).eq("platform", "googlebusiness").eq("is_active", true).limit(1).maybeSingle(),
  ]);
  const s = settingsRes.data;
  return {
    hasLocalSeo: true,
    account: account ? { id: account.accountId, reviewUrl: account.reviewUrl, mapsUrl: links?.maps_url ?? null } : null,
    settings: {
      autoReplyPositive: s?.auto_reply_positive ?? false,
      syncHours: s?.sync_hours ?? true,
      syncServices: s?.sync_services ?? true,
    },
    sync: { dueAt: s?.sync_due_at ?? null, lastSyncedAt: s?.last_synced_at ?? null, lastError: s?.last_sync_error ?? null },
  };
}

async function recordSync(admin: Admin, error: unknown | null): Promise<void> {
  await admin.supabaseAdmin.from("gbp_settings").upsert({
    business_id: admin.businessId,
    sync_due_at: null,
    ...(error ? {} : { last_synced_at: now() }),
    last_sync_error: error ? String(error instanceof Error ? error.message : error).slice(0, 500) : null,
    updated_at: now(),
  }, { onConflict: "business_id" });
}

/** Sends the post to Zernio (schedule or publish now) and stores the outcome. */
async function sendPost(admin: Admin, postId: string, accountId: string, draft: PostDraft): Promise<void> {
  try {
    const result = await zernio<{ post?: { _id?: string; status?: string; platforms?: { platformPostUrl?: string }[] } }>("/posts", {
      method: "POST", body: buildPostRequest(accountId, draft),
    });
    const published = !draft.scheduledFor;
    await admin.supabaseAdmin.from("gbp_posts").update({
      status: published ? "published" : "scheduled",
      published_at: published ? now() : null,
      zernio_post_id: result.post?._id?.slice(0, 64) ?? null,
      post_url: result.post?.platforms?.[0]?.platformPostUrl?.slice(0, 2000) ?? null,
      last_error: null,
      updated_at: now(),
    }).eq("id", postId);
  } catch (error) {
    await admin.supabaseAdmin.from("gbp_posts").update({
      status: "failed", last_error: String(error instanceof Error ? error.message : error).slice(0, 500), updated_at: now(),
    }).eq("id", postId);
    throw error;
  }
}

async function cancelScheduled(post: { status: string; zernio_post_id: string | null }): Promise<void> {
  if (post.status !== "scheduled" || !post.zernio_post_id) return;
  try {
    await zernio(`/posts/${encodeURIComponent(post.zernio_post_id)}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof ZernioError && error.status === 404)) throw error; // already gone in Zernio
  }
}

const ACTIONS: Record<string, { managerOnly?: boolean; run: (admin: Admin, body: Body) => Promise<unknown> }> = {
  status: { run: status },
  reviews: { run: async (admin) => ({ reviews: await listReviews(admin) }) },
  refresh_reviews: {
    run: async (admin) => {
      const account = await requireGbpAccount(admin.supabaseAdmin, admin.businessId);
      const unanswered = await syncReviews(admin.supabaseAdmin, admin.businessId, account.accountId);
      const settings = await loadGbpSettings(admin.supabaseAdmin, admin.businessId);
      let answered = 0;
      for (const review of unanswered) {
        if (answered >= AUTO_REPLY_BATCH) break;
        if (await autoReplyIfEligible(admin.supabaseAdmin, admin.businessId, review, settings)) answered++;
      }
      return { reviews: await listReviews(admin) };
    },
  },
  draft_reply: {
    managerOnly: true,
    run: async (admin, body) => {
      const review = await ownReview(admin, body.id);
      if (review.reply_text) throw new InputError("This review already has a reply.");
      return { draft: await draftReply(admin.supabaseAdmin, admin.businessId, review) };
    },
  },
  send_reply: {
    managerOnly: true,
    run: async (admin, body) => {
      const review = await ownReview(admin, body.id);
      await publishReply(admin.supabaseAdmin, admin.businessId, review, readReplyText(body.text), "owner");
      return { reviews: await listReviews(admin) };
    },
  },
  save_settings: {
    managerOnly: true,
    run: async (admin, body) => {
      const current = await loadGbpSettings(admin.supabaseAdmin, admin.businessId);
      const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
      const next = {
        auto_reply_positive: flag(body.autoReplyPositive, current.auto_reply_positive),
        sync_hours: flag(body.syncHours, current.sync_hours),
        sync_services: flag(body.syncServices, current.sync_services),
      };
      const switchedOn = (next.sync_hours && !current.sync_hours) || (next.sync_services && !current.sync_services);
      // Auto-reply covers reviews from this moment on, never the backlog.
      const autoReplySince = next.auto_reply_positive ? (current.auto_reply_positive ? current.auto_reply_since : now()) : null;
      const { error } = await admin.supabaseAdmin.from("gbp_settings").upsert({
        business_id: admin.businessId, ...next, auto_reply_since: autoReplySince, ...(switchedOn ? { sync_due_at: now() } : {}), updated_at: now(),
      }, { onConflict: "business_id" });
      if (error) throw new Error(error.message);
      return status(admin);
    },
  },
  sync_now: {
    managerOnly: true,
    run: async (admin) => {
      const settings = await loadGbpSettings(admin.supabaseAdmin, admin.businessId);
      try {
        await pushProfile(admin.supabaseAdmin, admin.businessId, settings);
        await recordSync(admin, null);
      } catch (error) {
        await recordSync(admin, error);
        throw error;
      }
      return status(admin);
    },
  },
  posts: { run: async (admin) => ({ posts: await listPosts(admin) }) },
  draft_post: {
    managerOnly: true,
    run: async (admin) => {
      const account = await requireGbpAccount(admin.supabaseAdmin, admin.businessId);
      const topic = pickPostTopic(await postTopics(admin.supabaseAdmin, admin.businessId), new Date());
      if (!topic) throw new InputError("Add a service first, so there is something to post about.");
      const content = await draftPostText(admin.supabaseAdmin, admin.businessId, topic);
      const shop = await loadMarketingShop(admin.supabaseAdmin, admin.businessId);
      const { data, error } = await admin.supabaseAdmin.from("gbp_posts").insert({
        business_id: admin.businessId, account_id: account.accountId, content, topic: topic.title.slice(0, 200),
        cta_type: shop.shopUrl ? "BOOK" : null, cta_url: shop.shopUrl,
      }).select(POST_COLUMNS).single();
      if (error) throw new Error(error.message);
      return { post: data };
    },
  },
  save_post: {
    managerOnly: true,
    run: async (admin, body) => {
      const mode = body.mode === "schedule" || body.mode === "publish" ? body.mode : "draft";
      const draft = readPostDraft({ ...body, scheduledFor: mode === "schedule" ? body.scheduledFor : null }, new Date());
      if (mode === "schedule" && !draft.scheduledFor) throw new InputError("Please choose when the post goes live.");
      const account = await requireGbpAccount(admin.supabaseAdmin, admin.businessId);
      const fields = {
        content: draft.content, cta_type: draft.ctaType, cta_url: draft.ctaUrl, account_id: account.accountId,
        scheduled_for: draft.scheduledFor, status: "draft", updated_at: now(),
      };
      let postId: string;
      if (body.id) {
        const existing = await ownPost(admin, body.id);
        if (isPostLive(existing, new Date())) throw new InputError("A published post can't be changed. Create a new one.");
        await cancelScheduled(existing);
        const { error } = await admin.supabaseAdmin.from("gbp_posts").update({ ...fields, zernio_post_id: null, last_error: null }).eq("id", existing.id);
        if (error) throw new Error(error.message);
        postId = existing.id;
      } else {
        const { data, error } = await admin.supabaseAdmin.from("gbp_posts").insert({ business_id: admin.businessId, ...fields }).select("id").single();
        if (error) throw new Error(error.message);
        postId = data.id;
      }
      if (mode !== "draft") {
        try {
          await sendPost(admin, postId, account.accountId, draft);
        } catch (error) {
          // The row is kept (status failed) and its id returned, so a retry edits it instead of creating a duplicate.
          const message = error instanceof ZernioError && error.status < 500 ? error.message : "Google is not reachable right now. Please try again.";
          if (!(error instanceof ZernioError)) console.error("local-seo-admin: post failed", error);
          return { posts: await listPosts(admin), postId, error: message };
        }
      }
      return { posts: await listPosts(admin), postId };
    },
  },
  delete_post: {
    managerOnly: true,
    run: async (admin, body) => {
      const post = await ownPost(admin, body.id);
      if (isPostLive(post, new Date())) throw new InputError("Published posts stay on Google for about 7 days and then fade out.");
      await cancelScheduled(post);
      await admin.supabaseAdmin.from("gbp_posts").delete().eq("id", post.id).eq("business_id", admin.businessId);
      return { posts: await listPosts(admin) };
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = ACTIONS[String(body.action ?? "")];
    if (!action) return json({ error: "Unknown action" }, 400);
    const admin = await requireActiveAdmin(req, action.managerOnly ? { roles: MANAGER_ROLES } : {});
    await requireLocalSeo(admin);
    return json(await action.run(admin, body));
  } catch (error) {
    const authError = authorizationErrorResponse(error, CORS);
    if (authError) return authError;
    if (error instanceof InputError || error instanceof GbpInputError) return json({ error: error.message }, 400);
    if (error instanceof PlanError) return json({ error: error.message, code: "plan_required" }, 402);
    if (error instanceof GbpActionError) return json({ error: error.message, code: error.code }, 409);
    if (error instanceof ZernioError) {
      return json({ error: error.status < 500 ? error.message : "Google is not reachable right now. Please try again." }, 502);
    }
    console.error("local-seo-admin failed:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
