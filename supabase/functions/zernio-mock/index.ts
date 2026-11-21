import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// STAGING ONLY. A stand-in for the Zernio API (and an OpenAI-compatible
// chat-completions endpoint) so local SEO can be tested end to end without a
// Google test profile. Point staging at it:
//   ZERNIO_BASE_URL=https://<staging>.supabase.co/functions/v1/zernio-mock/api/v1
//   RECEPTIONIST_AI_BASE_URL=https://<staging>.supabase.co/functions/v1/zernio-mock/llm
// It answers only on the zenno-staging project, and only to the staging
// ZERNIO_API_KEY / RECEPTIONIST_AI_API_KEY, or (as a shop's "own Zernio" account) to a key
// starting with OWN_KEY_PREFIX. Responses follow docs.zernio.com
// (platforms/google-business); nothing is stored, every call returns fixtures.

const STAGING_REF = "jylzbzbbjzpdbqxyezjw";
const GOOGLE_ACCOUNT = "mock-gbp-1";
/** Stands for a shop's own Zernio account in "bring your own Zernio" tests. */
const OWN_KEY_PREFIX = "zernio_mock_own_";
const MIN_KEY_LENGTH = 32;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const REVIEWS = [
  { id: "mockReview_5star", reviewer: { displayName: "Anna K." }, rating: 5, starRating: "FIVE", comment: "Die beste Thai-Massage in Hamburg. Sehr freundliches Team!", createTime: "2026-11-10T09:12:00Z", reviewReply: null },
  { id: "mockReview_4star", reviewer: { displayName: "Jonas M." }, rating: 4, starRating: "FOUR", comment: "Sehr entspannend, nur die Wartezeit war etwas lang.", createTime: "2026-11-08T16:40:00Z", reviewReply: null },
  { id: "mockReview_2star", reviewer: { displayName: "Petra S." }, rating: 2, starRating: "TWO", comment: "Termin wurde verschoben, ohne dass ich Bescheid bekam.", createTime: "2026-11-05T11:05:00Z", reviewReply: null },
  { id: "mockReview_replied", reviewer: { displayName: "Lea W." }, rating: 5, starRating: "FIVE", comment: "Wunderbar wie immer.", createTime: "2026-10-30T10:00:00Z", reviewReply: { comment: "Danke, Lea!", updateTime: "2026-10-30T12:00:00Z" } },
];

function zernioRoute(method: string, path: string, url: URL, body: Record<string, unknown>): Response {
  if (method === "GET" && path === "/profiles") return json({ profiles: [] });
  if (method === "POST" && path === "/profiles") return json({ profile: { _id: `mock-profile-${crypto.randomUUID().slice(0, 8)}` } });
  if (method === "GET" && path.startsWith("/connect/")) {
    // Hosted consent + location picker, skipped: straight back to Zenno.
    const redirect = url.searchParams.get("redirect_url") ?? "";
    const platform = path.split("/")[2];
    return json({ authUrl: `${redirect}${redirect.includes("?") ? "&" : "?"}profileId=${url.searchParams.get("profileId")}&accountId=${GOOGLE_ACCOUNT}`, platform });
  }
  if (method === "GET" && path === "/accounts") {
    return json({ accounts: [{ _id: GOOGLE_ACCOUNT, platform: "googlebusiness", username: "Sabai Spa Hamburg", displayName: "Sabai Spa Hamburg", isActive: true }] });
  }
  if (method === "DELETE" && path.startsWith("/accounts/")) return json({ success: true });
  const account = path.match(/^\/accounts\/([^/]+)\/(.+)$/);
  if (account) {
    const [, accountId, rest] = account;
    if (method === "GET" && rest === "gmb-location-details") {
      return json({
        success: true, accountId, locationId: "1234567890",
        location: { name: "Sabai Spa Hamburg", placeId: "ChIJmockSabai", reviewUrl: "https://search.google.com/local/writereview?placeid=ChIJmockSabai", mapsUri: "https://maps.google.com/maps?cid=1234567890", isVerified: true },
        title: "Sabai Spa Hamburg", categories: { primaryCategory: { name: "categories/gcid:massage_spa", displayName: "Massage spa" } },
      });
    }
    if (method === "PUT" && rest === "gmb-location-details") {
      if (body.updateMask !== "regularHours" || !Array.isArray((body.regularHours as { periods?: unknown[] })?.periods)) return json({ error: "updateMask and regularHours.periods required" }, 400);
      return json({ success: true, accountId, locationId: "1234567890" });
    }
    if (method === "PUT" && rest === "gmb-services") {
      if (!Array.isArray(body.serviceItems)) return json({ error: "serviceItems required" }, 400);
      return json({ success: true, services: body.serviceItems });
    }
    if (method === "GET" && rest === "gmb-reviews") {
      return json({ success: true, accountId, locationId: "1234567890", reviews: REVIEWS, averageRating: 4, totalReviewCount: REVIEWS.length, nextPageToken: null });
    }
    const reply = rest.match(/^gmb-reviews\/([^/]+)\/reply$/);
    if (method === "POST" && reply) {
      if (typeof body.comment !== "string" || !body.comment.trim()) return json({ error: "comment is required" }, 400);
      return json({ success: true, reviewId: reply[1], platform: "googlebusiness" });
    }
  }
  if (method === "POST" && path === "/posts") {
    if (typeof body.content !== "string" || !Array.isArray(body.platforms)) return json({ error: "content and platforms required" }, 400);
    const scheduled = !body.publishNow;
    return json({
      post: {
        _id: `mock-post-${crypto.randomUUID().slice(0, 8)}`, status: scheduled ? "scheduled" : "published",
        platforms: [{ platform: "googlebusiness", status: scheduled ? "scheduled" : "published", platformPostId: "localPosts/mock", platformPostUrl: scheduled ? null : "https://business.google.com/posts/mock" }],
      },
    }, 201);
  }
  if (method === "DELETE" && path.startsWith("/posts/")) return json({ success: true });
  if (method === "POST" && path === "/webhooks/settings") {
    if (typeof body.url !== "string" || !Array.isArray(body.events)) return json({ error: "name, url and events required" }, 400);
    return json({ success: true, webhook: { _id: `mock-webhook-${crypto.randomUUID().slice(0, 8)}`, url: body.url, events: body.events, isActive: true } });
  }
  if (method === "DELETE" && path === "/webhooks/settings") return json({ success: true });
  if (method === "GET" && path === "/comment-automations") return json({ automations: [] });
  return json({ error: `zernio-mock: ${method} ${path} is not mocked` }, 404);
}

function llmRoute(body: Record<string, unknown>): Response {
  const messages = Array.isArray(body.messages) ? body.messages as { role: string; content: string }[] : [];
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const isReview = user.includes("<review>");
  const name = user.match(/Reviewer: (.+)/)?.[1]?.split(" ")[0] ?? "";
  const content = isReview
    ? `Liebe/r ${name}, vielen Dank für Ihre Bewertung! Es freut uns sehr, dass Sie sich bei uns wohlgefühlt haben. Wir freuen uns auf Ihren nächsten Besuch.`
    : `Gönnen Sie sich diese Woche eine Auszeit: ${user.match(/Topic: (.+)/)?.[1] ?? "unsere Behandlungen"}. Unser Team nimmt sich Zeit für Sie – buchen Sie Ihren Termin bequem online.`;
  return json({ model: "mock", choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
}

Deno.serve(async (req) => {
  if (!(Deno.env.get("SUPABASE_URL") ?? "").includes(STAGING_REF)) return json({ error: "not available" }, 404);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/zernio-mock/, "");
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const isLlm = path.startsWith("/llm/");
  const expected = Deno.env.get(isLlm ? "RECEPTIONIST_AI_API_KEY" : "ZERNIO_API_KEY") ?? "";
  const isOwnAccount = !isLlm && token.startsWith(OWN_KEY_PREFIX) && token.length >= MIN_KEY_LENGTH;
  if (!isOwnAccount && (expected.length < MIN_KEY_LENGTH || token !== expected)) return json({ error: "Unauthorized" }, 401);
  const body = req.method === "GET" || req.method === "DELETE" ? {} : await req.json().catch(() => ({}));
  if (isLlm) return path === "/llm/chat/completions" ? llmRoute(body) : json({ error: "not mocked" }, 404);
  if (!path.startsWith("/api/v1/")) return json({ error: "not mocked" }, 404);
  return zernioRoute(req.method, path.slice("/api/v1".length), url, body);
});
