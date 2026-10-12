import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

interface AdminRecord {
  id: string;
  business_id: string;
  role: string;
  is_active: boolean;
}

export interface AuthorizedAdmin {
  admin: AdminRecord;
  businessId: string;
  supabaseAdmin: SupabaseClient;
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service configuration is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findAdminForUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  email?: string | null,
): Promise<AdminRecord | null> {
  const columns = "id, business_id, role, is_active";

  const { data: byAuthUserId } = await supabaseAdmin
    .from("admin_users")
    .select(columns)
    .eq("auth_user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (byAuthUserId) return byAuthUserId as AdminRecord;

  const { data: byUserId } = await supabaseAdmin
    .from("admin_users")
    .select(columns)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (byUserId) return byUserId as AdminRecord;

  if (!email) return null;

  const { data: byEmail } = await supabaseAdmin
    .from("admin_users")
    .select(columns)
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  return (byEmail as AdminRecord | null) ?? null;
}

export async function requireActiveAdmin(
  req: Request,
  options: { businessId?: string; roles?: string[] } = {},
): Promise<AuthorizedAdmin> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthorizationError("Sign in is required", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthorizationError("Sign in is required", 401);
  }

  const supabaseAdmin = getServiceClient();
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthorizationError("Your session is no longer valid", 401);
  }

  const admin = await findAdminForUser(
    supabaseAdmin,
    data.user.id,
    data.user.email,
  );

  if (!admin) {
    throw new AuthorizationError("No active business account was found", 403);
  }

  if (options.businessId && admin.business_id !== options.businessId) {
    throw new AuthorizationError("You cannot manage another business", 403);
  }

  if (options.roles?.length && !options.roles.includes(admin.role)) {
    throw new AuthorizationError("Only the business owner can manage payment connections", 403);
  }

  return {
    admin,
    businessId: admin.business_id,
    supabaseAdmin,
  };
}

export function authorizationErrorResponse(error: unknown, corsHeaders: HeadersInit) {
  if (error instanceof AuthorizationError) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null;
}

/** True when another edge function calls with the service-role key. */
export function isServiceRoleRequest(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return serviceKey.length > 0 && token === serviceKey;
}

/** Server calls pass; otherwise the caller must be an active admin of this business. */
export async function requireBusinessAccess(req: Request, businessId: string): Promise<void> {
  if (isServiceRoleRequest(req)) return;
  await requireActiveAdmin(req, { businessId });
}


/** The caller must be an admin of the shop that owns this custom domain (or a server call). */
export async function requireDomainAccess(req: Request, domainId: string): Promise<void> {
  if (isServiceRoleRequest(req)) return;
  const { data: domain, error } = await getServiceClient()
    .from("custom_domains")
    .select("business_id")
    .eq("id", domainId)
    .maybeSingle();
  if (error) throw new Error(`Could not load domain: ${error.message}`);
  if (!domain) throw new AuthorizationError("Domain not found", 404);
  await requireActiveAdmin(req, { businessId: domain.business_id });
}
