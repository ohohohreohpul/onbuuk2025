import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizationErrorResponse, requireActiveAdmin } from "../_shared/adminAuthorization.ts";
import { returnBase } from "../_shared/billing/stripeBilling.ts";
import {
  AutomationInputError, fromZernioAutomation, readAutomationDraft, toZernioAutomation,
} from "../_shared/social/commentAutomation.ts";
import { refreshLocation } from "../_shared/social/gbpService.ts";
import { ensureProfile, syncAccounts, zernio, ZernioError } from "../_shared/social/zernioClient.ts";
import { isConnectPlatform, type ConnectPlatform } from "../_shared/social/zernioWebhook.ts";

// Admin API for Zenno Social: POST { action, ... } with the admin's JWT.
//   status                 plan + connected accounts (no Zernio call)
//   connect   {platform}   OAuth link for Instagram / Facebook / Google Business Profile
//                          (Zernio hosts the consent and the Google location picker)
//   sync                   refresh the account list after the OAuth redirect
//   disconnect {accountId}
//   automations / save_automation {id?, ...} / delete_automation {id}
// Everything except status needs the Social plan. Zernio is only ever called
// with this shop's own profile, and ids from the client are checked against it.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MANAGER_ROLES = ["owner", "admin", "manager"];
const OBJECT_ID = /^[a-zA-Z0-9_-]{1,64}$/;
/** Zenno Social includes 2 Instagram/Facebook accounts (each costs a Zernio seat); custom plans have no limit. */
const SOCIAL_ACCOUNT_LIMIT = 2;
/** Plus one Google location (local SEO). */
const GOOGLE_ACCOUNT_LIMIT = 1;

type Body = Record<string, unknown>;
type Admin = Awaited<ReturnType<typeof requireActiveAdmin>>;

class InputError extends Error {}
class PlanError extends Error {}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function hasSocial({ supabaseAdmin, businessId }: Admin): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("business_has_social", { p_business_id: businessId });
  if (error) throw new Error(`plan check failed: ${error.message}`);
  return data === true;
}

async function requireSocial(admin: Admin): Promise<void> {
  if (!(await hasSocial(admin))) throw new PlanError("Instagram and Facebook are part of the Zenno Social plan.");
}

/** Local SEO: Social plan and the shop is on the rollout list. */
async function hasLocalSeo({ supabaseAdmin, businessId }: Admin): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("business_has_local_seo", { p_business_id: businessId });
  if (error) throw new Error(`plan check failed: ${error.message}`);
  return data === true;
}

async function profileOf(admin: Admin): Promise<string> {
  const { data: shop } = await admin.supabaseAdmin.from("businesses").select("name").eq("id", admin.businessId).single();
  return ensureProfile(admin.supabaseAdmin, admin.businessId, shop?.name ?? "Shop");
}

async function accounts(admin: Admin) {
  const { data, error } = await admin.supabaseAdmin.from("social_accounts")
    .select("zernio_account_id, platform, username, display_name, picture_url, is_active")
    .eq("business_id", admin.businessId).order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    id: a.zernio_account_id, platform: a.platform, username: a.username, displayName: a.display_name,
    pictureUrl: a.picture_url, isActive: a.is_active,
  }));
}

async function requireAccountSlot({ supabaseAdmin, businessId }: Admin, platform: ConnectPlatform): Promise<void> {
  const isGoogle = platform === "googlebusiness";
  const { data: shop } = await supabaseAdmin.from("businesses").select("plan_type").eq("id", businessId).single();
  if (shop?.plan_type === "custom" && !isGoogle) return;
  let query = supabaseAdmin.from("social_accounts").select("id", { count: "exact", head: true })
    .eq("business_id", businessId).eq("is_active", true);
  query = isGoogle ? query.eq("platform", "googlebusiness") : query.neq("platform", "googlebusiness");
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  if (isGoogle && (count ?? 0) >= GOOGLE_ACCOUNT_LIMIT) {
    throw new InputError("A Google Business Profile is already connected. Disconnect it first to connect another location.");
  }
  if (!isGoogle && (count ?? 0) >= SOCIAL_ACCOUNT_LIMIT) {
    throw new InputError(`Zenno Social includes ${SOCIAL_ACCOUNT_LIMIT} accounts. Disconnect one first, or write to support@zennohq.com for more.`);
  }
}

/** After a Google connect: store the listing's review link and category (best effort). */
async function refreshGoogleLocations(admin: Admin): Promise<void> {
  const { data } = await admin.supabaseAdmin.from("social_accounts").select("zernio_account_id")
    .eq("business_id", admin.businessId).eq("platform", "googlebusiness").eq("is_active", true);
  for (const row of data ?? []) {
    await refreshLocation(admin.supabaseAdmin, admin.businessId, row.zernio_account_id).catch((error) => console.error("google location refresh failed:", error));
  }
}

/** The account id must be one of this shop's active accounts. */
async function ownAccount(admin: Admin, accountId: unknown): Promise<string> {
  const id = typeof accountId === "string" ? accountId : "";
  if (!OBJECT_ID.test(id)) throw new InputError("Unknown account.");
  const { data } = await admin.supabaseAdmin.from("social_accounts").select("zernio_account_id")
    .eq("business_id", admin.businessId).eq("zernio_account_id", id).eq("is_active", true).maybeSingle();
  if (!data) throw new InputError("This account is not connected to your shop.");
  return id;
}

/** The automation must belong to this shop's profile (Zernio lists per profile). */
async function ownAutomation(admin: Admin, profileId: string, automationId: unknown): Promise<string> {
  const id = typeof automationId === "string" ? automationId : "";
  if (!OBJECT_ID.test(id)) throw new InputError("Unknown automation.");
  const { automations } = await zernio<{ automations: Record<string, unknown>[] }>("/comment-automations", { query: { profileId } });
  if (!(automations ?? []).some((a) => String(a.id ?? a._id) === id)) throw new InputError("Unknown automation.");
  return id;
}

const ACTIONS: Record<string, { managerOnly?: boolean; run: (admin: Admin, body: Body, req: Request) => Promise<unknown> }> = {
  status: {
    run: async (admin) => ({ hasSocial: await hasSocial(admin), hasLocalSeo: await hasLocalSeo(admin), accounts: await accounts(admin) }),
  },
  connect: {
    managerOnly: true,
    run: async (admin, body, req) => {
      await requireSocial(admin);
      if (!isConnectPlatform(body.platform)) throw new InputError("Choose Instagram, Facebook or Google.");
      if (body.platform === "googlebusiness" && !(await hasLocalSeo(admin))) {
        throw new PlanError("Google Business Profile is part of the Zenno Social plan.");
      }
      await requireAccountSlot(admin, body.platform);
      const profileId = await profileOf(admin);
      const redirect = `${returnBase(req)}/admin?view=social&connected=${body.platform}`;
      const result = await zernio<{ authUrl?: string }>(`/connect/${body.platform}`, { query: { profileId, redirect_url: redirect } });
      if (!result.authUrl) throw new Error("Zernio returned no authUrl");
      return { url: result.authUrl };
    },
  },
  sync: {
    run: async (admin) => {
      await requireSocial(admin);
      await syncAccounts(admin.supabaseAdmin, admin.businessId, await profileOf(admin));
      await refreshGoogleLocations(admin);
      return { accounts: await accounts(admin) };
    },
  },
  disconnect: {
    managerOnly: true,
    run: async (admin, body) => {
      const accountId = await ownAccount(admin, body.accountId);
      await zernio(`/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
      await admin.supabaseAdmin.from("social_accounts").update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("business_id", admin.businessId).eq("zernio_account_id", accountId);
      return { accounts: await accounts(admin) };
    },
  },
  automations: {
    run: async (admin) => {
      await requireSocial(admin);
      const { automations } = await zernio<{ automations: Record<string, unknown>[] }>("/comment-automations", { query: { profileId: await profileOf(admin) } });
      return { automations: (automations ?? []).map(fromZernioAutomation) };
    },
  },
  save_automation: {
    managerOnly: true,
    run: async (admin, body) => {
      await requireSocial(admin);
      const draft = readAutomationDraft(body);
      await ownAccount(admin, draft.accountId);
      const profileId = await profileOf(admin);
      if (body.id) {
        const id = await ownAutomation(admin, profileId, body.id);
        const { automation } = await zernio<{ automation: Record<string, unknown> }>(`/comment-automations/${id}`, {
          method: "PATCH", body: toZernioAutomation(draft, null),
        });
        return { automation: fromZernioAutomation(automation ?? { id }) };
      }
      const { automation } = await zernio<{ automation: Record<string, unknown> }>("/comment-automations", {
        method: "POST", body: toZernioAutomation(draft, profileId),
      });
      return { automation: fromZernioAutomation(automation) };
    },
  },
  delete_automation: {
    managerOnly: true,
    run: async (admin, body) => {
      await requireSocial(admin);
      const id = await ownAutomation(admin, await profileOf(admin), body.id);
      await zernio(`/comment-automations/${id}`, { method: "DELETE" });
      return { deleted: true };
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
    return json(await action.run(admin, body, req));
  } catch (error) {
    const authError = authorizationErrorResponse(error, CORS);
    if (authError) return authError;
    if (error instanceof InputError || error instanceof AutomationInputError) return json({ error: error.message }, 400);
    if (error instanceof PlanError) return json({ error: error.message, code: "plan_required" }, 402);
    if (error instanceof ZernioError) {
      // Zernio's message helps the owner (e.g. "account needs reconnecting"); never leak a 5xx body.
      return json({ error: error.status < 500 ? error.message : "Instagram/Facebook is not reachable right now. Please try again." }, 502);
    }
    console.error("social-admin failed:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
