import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizationErrorResponse, requireActiveAdmin } from "../_shared/adminAuthorization.ts";
import { sendReply } from "../_shared/receptionist/agent.ts";
import { appendMessage, updateConversation, type ConversationRow } from "../_shared/receptionist/conversations.ts";
import { makeDeliver, shopMailbox } from "../_shared/receptionist/deliver.ts";
import { assertPublicMailHost, ImapClient, ImapError } from "../_shared/receptionist/imap.ts";
import { isLlmConfigured } from "../_shared/receptionist/llm.ts";
import type { ReceptionistSettings } from "../_shared/receptionist/shopContext.ts";
import { isTypesafeConfigured } from "../_shared/typesafe.ts";
import { cloudVerify, gatewayConnect, gatewayDisconnect, isGatewayConfigured, toWhatsappNumber } from "../_shared/receptionist/whatsapp.ts";

// Admin API of the AI receptionist: POST { action, ...payload } with the admin's JWT.
// Reads (conversations, messages, consents, campaigns) go straight to the
// tables through RLS; every write goes through here.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MANAGER_ROLES = ["owner", "admin", "manager"];
const MAX_REPLY_CHARS = 4000;
const MAX_IMPORT_ROWS = 3000;
const HOST = /^[A-Za-z0-9.-]{3,253}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IMAP_TLS_PORT = 993;
const PAGE_SIZE = 1000;

type Body = Record<string, unknown>;

/** Reads every row of a query in pages (PostgREST returns at most 1000 at a time). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
type Admin = Awaited<ReturnType<typeof requireActiveAdmin>>;

class InputError extends Error {}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const bool = (value: unknown) => value === true;

function need<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined || value === "") throw new InputError(message);
  return value;
}

async function ensureSettings({ supabaseAdmin, businessId }: Admin): Promise<ReceptionistSettings> {
  const { data } = await supabaseAdmin.from("receptionist_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (data) return data as ReceptionistSettings;
  const { data: created, error } = await supabaseAdmin.from("receptionist_settings").insert({ business_id: businessId }).select("*").single();
  if (error || !created) throw new Error(`settings insert failed: ${error?.message}`);
  return created as ReceptionistSettings;
}

async function overview(admin: Admin) {
  const settings = await ensureSettings(admin);
  const { supabaseAdmin: db, businessId } = admin;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [mailbox, token, needsHuman, drafts, usage] = await Promise.all([
    shopMailbox(db, businessId),
    db.rpc("receptionist_get_secret", { p_business_id: businessId, p_kind: "whatsapp_cloud_token" }),
    db.from("receptionist_conversations").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "needs_human"),
    db.from("receptionist_messages").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "draft"),
    db.from("receptionist_usage").select("prompt_tokens, completion_tokens").eq("business_id", businessId).gte("created_at", monthStart),
  ]);
  const tokens = (usage.data ?? []).reduce((sum, row) => sum + row.prompt_tokens + row.completion_tokens, 0);
  const { whatsapp_qr: qr, ...rest } = settings as ReceptionistSettings & { whatsapp_qr?: string | null };
  return {
    settings: rest,
    whatsappQr: qr ?? null,
    status: {
      aiConfigured: isLlmConfigured(),
      jevConfigured: isTypesafeConfigured(),
      qrGatewayAvailable: isGatewayConfigured(),
      mailbox: mailbox ? { address: mailbox.from_email, smtpHost: mailbox.smtp_host } : null,
      hasCloudToken: Boolean(token.data),
      needsHuman: needsHuman.count ?? 0,
      drafts: drafts.count ?? 0,
      tokensThisMonth: tokens,
    },
  };
}

const MODES = ["auto", "drafts"];

async function updateSettings(admin: Admin, body: Body) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const input = (body.patch ?? {}) as Body;
  for (const key of ["is_enabled", "web_enabled", "email_enabled", "whatsapp_enabled"]) if (key in input) patch[key] = bool(input[key]);
  for (const key of ["web_mode", "email_mode", "whatsapp_mode"]) {
    if (key in input) {
      if (!MODES.includes(String(input[key]))) throw new InputError(`${key} must be auto or drafts`);
      patch[key] = input[key];
    }
  }
  if ("assistant_name" in input) patch.assistant_name = need(str(input.assistant_name, 40), "The assistant needs a name");
  if ("instructions" in input) patch.instructions = str(input.instructions, 4000);
  if ("knowledge" in input) patch.knowledge = str(input.knowledge, 12000);
  if ("widget_greeting" in input) patch.widget_greeting = str(input.widget_greeting, 300);
  if ("widget_color" in input) {
    const color = str(input.widget_color, 7);
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) throw new InputError("Colour must look like #1A1714");
    patch.widget_color = color || null;
  }
  await ensureSettings(admin);
  const { error } = await admin.supabaseAdmin.from("receptionist_settings").update(patch).eq("business_id", admin.businessId);
  if (error) throw new Error(`settings update failed: ${error.message}`);
  return overview(admin);
}

async function conversationOf(admin: Admin, id: unknown): Promise<ConversationRow> {
  const { data } = await admin.supabaseAdmin.from("receptionist_conversations").select("*")
    .eq("id", str(id, 40)).eq("business_id", admin.businessId).maybeSingle();
  if (!data) throw new InputError("Conversation not found");
  return data as ConversationRow;
}

async function staffReply(admin: Admin, body: Body) {
  const conversation = await conversationOf(admin, body.conversationId);
  const text = need(str(body.text, MAX_REPLY_CHARS), "Write a reply first");
  const settings = await ensureSettings(admin);
  const message = await sendReply(admin.supabaseAdmin, conversation, text, "staff", makeDeliver(admin.supabaseAdmin, settings), { by: admin.admin.id });
  // A person answered: the AI stays quiet in this conversation until it is handed back.
  await updateConversation(admin.supabaseAdmin, conversation.id, { is_ai_paused: true, unread_count: 0, status: conversation.status === "closed" ? "open" : conversation.status });
  return { message };
}

async function sendDraft(admin: Admin, body: Body) {
  // Claim the draft first, so a double click cannot send it twice.
  const { data: draft } = await admin.supabaseAdmin.from("receptionist_messages").update({ status: "discarded" })
    .eq("id", str(body.messageId, 40)).eq("business_id", admin.businessId).eq("status", "draft")
    .select("id, conversation_id, body, meta").maybeSingle();
  if (!draft) throw new InputError("This draft was already sent or discarded");
  const conversation = await conversationOf(admin, draft.conversation_id);
  const text = str(body.text, MAX_REPLY_CHARS) || draft.body;
  const settings = await ensureSettings(admin);
  const message = await sendReply(admin.supabaseAdmin, conversation, text, "ai", makeDeliver(admin.supabaseAdmin, settings), {
    ...(draft.meta as Body), approved_by: admin.admin.id, edited: text !== draft.body,
  });
  await updateConversation(admin.supabaseAdmin, conversation.id, { unread_count: 0 });
  return { message };
}

async function discardDraft(admin: Admin, body: Body) {
  const { error } = await admin.supabaseAdmin.from("receptionist_messages").update({ status: "discarded" })
    .eq("id", str(body.messageId, 40)).eq("business_id", admin.businessId).eq("status", "draft");
  if (error) throw new Error(error.message);
  return { ok: true };
}

async function setConversation(admin: Admin, body: Body) {
  const conversation = await conversationOf(admin, body.conversationId);
  const patch: Partial<ConversationRow> = {};
  if ("isAiPaused" in body) patch.is_ai_paused = bool(body.isAiPaused);
  if (body.resolve === true) Object.assign(patch, { status: "open", needs_human_reason: null, is_ai_paused: false });
  if (body.close === true) patch.status = "closed";
  if (body.markRead === true) patch.unread_count = 0;
  await updateConversation(admin.supabaseAdmin, conversation.id, patch);
  if (body.resolve === true) {
    await appendMessage(admin.supabaseAdmin, conversation, { direction: "out", author: "system", body: "Handed back to the AI receptionist" });
  }
  return { ok: true };
}

async function connectEmail(admin: Admin, body: Body) {
  const host = str(body.imapHost, 253);
  const port = Number(body.imapPort ?? 993);
  if (!HOST.test(host)) throw new InputError("Enter the IMAP server, e.g. imap.strato.de");
  if (port !== IMAP_TLS_PORT) throw new InputError("Please use port 993 (SSL/TLS).");
  try {
    await assertPublicMailHost(host);
  } catch (error) {
    throw new InputError(error instanceof ImapError ? error.message : "This mail server name could not be found");
  }
  const mailbox = await shopMailbox(admin.supabaseAdmin, admin.businessId);
  if (!mailbox) throw new InputError("First set up your own mailbox under Settings > Emails (SMTP).");
  const username = str(body.imapUsername, 254) || mailbox.smtp_username;
  const password = str(body.imapPassword, 500);
  const effectivePassword = password || mailbox.smtp_password;
  if (!username || !effectivePassword) throw new InputError("User name and password are needed");

  const client = new ImapClient();
  try {
    await client.connect(host, port);
    await client.login(username, effectivePassword);
    await client.selectInbox();
  } catch (error) {
    throw new InputError(`Could not open the mailbox: ${error instanceof Error ? error.message : error}`);
  } finally {
    await client.logout();
  }
  if (password) await admin.supabaseAdmin.rpc("receptionist_set_secret", { p_business_id: admin.businessId, p_kind: "imap_password", p_value: password });
  await ensureSettings(admin);
  await admin.supabaseAdmin.from("receptionist_settings").update({
    imap_host: host, imap_port: port, imap_username: str(body.imapUsername, 254) || null, imap_last_uid: 0, imap_error: null, updated_at: new Date().toISOString(),
  }).eq("business_id", admin.businessId);
  return overview(admin);
}

async function connectWhatsappCloud(admin: Admin, body: Body) {
  const phoneNumberId = str(body.phoneNumberId, 40);
  const token = str(body.token, 1000);
  if (!/^\d{6,30}$/.test(phoneNumberId)) throw new InputError("Phone number ID: digits from Meta's WhatsApp Manager");
  if (token.length < 20) throw new InputError("Paste the permanent access token");
  let display: string;
  try {
    display = await cloudVerify(phoneNumberId, token);
  } catch (error) {
    throw new InputError(`Meta did not accept this number or token: ${error instanceof Error ? error.message : error}`);
  }
  const db = admin.supabaseAdmin;
  await db.rpc("receptionist_set_secret", { p_business_id: admin.businessId, p_kind: "whatsapp_cloud_token", p_value: token });
  const appSecret = str(body.appSecret, 200);
  if (appSecret) await db.rpc("receptionist_set_secret", { p_business_id: admin.businessId, p_kind: "whatsapp_app_secret", p_value: appSecret });
  await ensureSettings(admin);
  const { error } = await db.from("receptionist_settings").update({
    whatsapp_provider: "cloud_api", whatsapp_phone_number_id: phoneNumberId, whatsapp_display_phone: display || null,
    whatsapp_status: "connected", whatsapp_instance: null, whatsapp_qr: null, updated_at: new Date().toISOString(),
  }).eq("business_id", admin.businessId);
  if (error?.code === "23505") throw new InputError("This WhatsApp number is already connected to another shop.");
  if (error) throw new Error(error.message);
  return overview(admin);
}

async function connectWhatsappQr(admin: Admin) {
  if (!isGatewayConfigured()) throw new InputError("The 'own number' connection is not available on this server yet.");
  const instance = `zenno_${admin.businessId.replace(/-/g, "")}`;
  const webhook = `${Deno.env.get("SUPABASE_URL")}/functions/v1/receptionist-whatsapp?provider=qr`;
  const qr = await gatewayConnect(instance, webhook);
  await ensureSettings(admin);
  await admin.supabaseAdmin.from("receptionist_settings").update({
    whatsapp_provider: "qr_gateway", whatsapp_instance: instance, whatsapp_status: "pending_qr", whatsapp_qr: qr,
    whatsapp_phone_number_id: null, updated_at: new Date().toISOString(),
  }).eq("business_id", admin.businessId);
  return overview(admin);
}

async function disconnectWhatsapp(admin: Admin) {
  const settings = await ensureSettings(admin);
  if (settings.whatsapp_provider === "qr_gateway" && settings.whatsapp_instance && isGatewayConfigured()) await gatewayDisconnect(settings.whatsapp_instance);
  await admin.supabaseAdmin.rpc("receptionist_set_secret", { p_business_id: admin.businessId, p_kind: "whatsapp_cloud_token", p_value: "" });
  await admin.supabaseAdmin.from("receptionist_settings").update({
    whatsapp_provider: null, whatsapp_status: "disconnected", whatsapp_phone_number_id: null, whatsapp_instance: null,
    whatsapp_qr: null, whatsapp_enabled: false, updated_at: new Date().toISOString(),
  }).eq("business_id", admin.businessId);
  return overview(admin);
}

interface ImportRow { name?: string; email?: string; phone?: string; consent?: boolean; evidence?: string }

/** Imports a consented contact list: customers are matched by email (or phone); consent stored per row. */
async function importConsents(admin: Admin, body: Body) {
  const rows = Array.isArray(body.rows) ? (body.rows as ImportRow[]).slice(0, MAX_IMPORT_ROWS) : [];
  if (rows.length === 0) throw new InputError("The file has no rows");
  const evidenceDefault = str(body.evidence, 500) || "Consent given to the shop (imported list)";
  const db = admin.supabaseAdmin;
  const existing = await fetchAll<{ id: string; email: string; phone: string | null }>((from, to) =>
    db.from("customers").select("id, email, phone").eq("business_id", admin.businessId).order("id").range(from, to));
  const revoked = new Set((await fetchAll<{ customer_id: string }>((from, to) =>
    db.from("customer_contact_consents").select("customer_id").eq("business_id", admin.businessId).eq("channel", "whatsapp").eq("status", "revoked").order("customer_id").range(from, to)))
    .map((row) => row.customer_id));
  const byEmail = new Map(existing.map((c) => [String(c.email).toLowerCase(), c.id]));
  const byPhone = new Map(existing.filter((c) => c.phone).map((c) => [toWhatsappNumber(String(c.phone)) ?? "", c.id]));
  const result = { imported: 0, consented: 0, skipped: [] as string[] };

  for (const [index, row] of rows.entries()) {
    const email = str(row.email, 254).toLowerCase();
    const phone = str(row.phone, 40);
    const number = phone ? toWhatsappNumber(phone) : null;
    let customerId = (email && byEmail.get(email)) || (number && byPhone.get(number)) || null;
    if (!customerId) {
      if (!EMAIL.test(email)) { result.skipped.push(`Row ${index + 2}: email missing (needed for new customers)`); continue; }
      const { data, error } = await db.from("customers").insert({ business_id: admin.businessId, email, name: str(row.name, 120) || email, phone: phone || null }).select("id").single();
      if (error || !data) { result.skipped.push(`Row ${index + 2}: ${error?.message ?? "could not be saved"}`); continue; }
      customerId = data.id as string;
      byEmail.set(email, customerId);
    }
    result.imported++;
    if (row.consent !== true) continue;
    if (!number) { result.skipped.push(`Row ${index + 2}: consent given but no valid phone number`); continue; }
    // Someone who said STOP is never re-subscribed by an (old) list.
    if (revoked.has(customerId)) { result.skipped.push(`Row ${index + 2}: opted out earlier – not re-subscribed`); continue; }
    const { error } = await db.from("customer_contact_consents").upsert({
      business_id: admin.businessId, customer_id: customerId, channel: "whatsapp", status: "granted", source: "import",
      evidence: str(row.evidence, 1000) || evidenceDefault, recorded_at: new Date().toISOString(), recorded_by: admin.admin.id,
    }, { onConflict: "business_id,customer_id,channel" });
    if (!error) result.consented++;
  }
  return { ...result, skipped: result.skipped.slice(0, 50) };
}

async function setConsent(admin: Admin, body: Body) {
  const customerId = str(body.customerId, 40);
  const { data: customer } = await admin.supabaseAdmin.from("customers").select("id").eq("id", customerId).eq("business_id", admin.businessId).maybeSingle();
  if (!customer) throw new InputError("Customer not found");
  const isGranted = bool(body.granted);
  const { error } = await admin.supabaseAdmin.from("customer_contact_consents").upsert({
    business_id: admin.businessId, customer_id: customerId, channel: "whatsapp", status: isGranted ? "granted" : "revoked",
    source: "staff", evidence: str(body.evidence, 1000) || (isGranted ? "Customer agreed in person" : "Revoked by staff"),
    recorded_at: new Date().toISOString(), recorded_by: admin.admin.id,
  }, { onConflict: "business_id,customer_id,channel" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Consented customers with a usable WhatsApp number. */
async function audience(admin: Admin): Promise<{ customer_id: string; address: string; name: string | null }[]> {
  const data = await fetchAll<{ customer_id: string; customers: unknown }>((from, to) => admin.supabaseAdmin.from("customer_contact_consents")
    .select("customer_id, customers!inner(name, phone)").eq("business_id", admin.businessId).eq("channel", "whatsapp").eq("status", "granted")
    .order("customer_id").range(from, to));
  return data.flatMap((row) => {
    const customer = (Array.isArray(row.customers) ? row.customers[0] : row.customers) as { name: string | null; phone: string | null } | null;
    const address = customer?.phone ? toWhatsappNumber(customer.phone) : null;
    return address ? [{ customer_id: row.customer_id as string, address, name: customer?.name ?? null }] : [];
  });
}

async function saveCampaign(admin: Admin, body: Body) {
  const name = need(str(body.name, 120), "Give the message a name");
  const message = need(str(body.message, 1500), "Write the message");
  const templateName = str(body.templateName, 512) || null;
  if (templateName && !/^[a-z0-9_]+$/.test(templateName)) throw new InputError("Template name: lowercase letters, digits and _ only");
  const row = {
    business_id: admin.businessId, name, message, is_personalised: bool(body.isPersonalised),
    template_name: templateName, template_language: str(body.templateLanguage, 5) || null,
  };
  const id = str(body.campaignId, 40);
  const query = id
    ? admin.supabaseAdmin.from("outreach_campaigns").update(row).eq("id", id).eq("business_id", admin.businessId).eq("status", "draft")
    : admin.supabaseAdmin.from("outreach_campaigns").insert(row);
  const { data, error } = await query.select("*").single();
  if (error || !data) throw new InputError(error?.message ?? "Only drafts can be changed");
  return { campaign: data, audience: (await audience(admin)).length };
}

async function startCampaign(admin: Admin, body: Body) {
  const settings = await ensureSettings(admin);
  if (settings.whatsapp_status !== "connected") throw new InputError("Connect WhatsApp first.");
  const { data: campaign } = await admin.supabaseAdmin.from("outreach_campaigns").select("*")
    .eq("id", str(body.campaignId, 40)).eq("business_id", admin.businessId).maybeSingle();
  if (!campaign || campaign.status !== "draft") throw new InputError("Campaign not found or already started");
  if (settings.whatsapp_provider === "cloud_api" && !campaign.template_name) throw new InputError("Official WhatsApp needs an approved template name for outreach.");
  const people = await audience(admin);
  if (people.length === 0) throw new InputError("Nobody has agreed to WhatsApp messages yet.");
  const { error } = await admin.supabaseAdmin.from("outreach_recipients").upsert(
    people.map((p) => ({ ...p, campaign_id: campaign.id, business_id: admin.businessId })),
    { onConflict: "campaign_id,customer_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  await admin.supabaseAdmin.from("outreach_campaigns").update({ status: "sending", started_at: new Date().toISOString(), recipient_count: people.length }).eq("id", campaign.id);
  return { recipients: people.length };
}

async function pauseCampaign(admin: Admin, body: Body, isPaused: boolean) {
  const { error } = await admin.supabaseAdmin.from("outreach_campaigns").update({ status: isPaused ? "paused" : "sending" })
    .eq("id", str(body.campaignId, 40)).eq("business_id", admin.businessId).in("status", isPaused ? ["sending"] : ["paused"]);
  if (error) throw new Error(error.message);
  return { ok: true };
}

const ACTIONS: Record<string, { managerOnly: boolean; run: (admin: Admin, body: Body) => Promise<unknown> }> = {
  overview: { managerOnly: false, run: (a) => overview(a) },
  update_settings: { managerOnly: true, run: updateSettings },
  reply: { managerOnly: false, run: staffReply },
  send_draft: { managerOnly: false, run: sendDraft },
  discard_draft: { managerOnly: false, run: discardDraft },
  set_conversation: { managerOnly: false, run: setConversation },
  connect_email: { managerOnly: true, run: connectEmail },
  connect_whatsapp_cloud: { managerOnly: true, run: connectWhatsappCloud },
  connect_whatsapp_qr: { managerOnly: true, run: (a) => connectWhatsappQr(a) },
  disconnect_whatsapp: { managerOnly: true, run: (a) => disconnectWhatsapp(a) },
  import_consents: { managerOnly: true, run: importConsents },
  set_consent: { managerOnly: false, run: setConsent },
  audience: { managerOnly: true, run: async (a) => ({ count: (await audience(a)).length }) },
  save_campaign: { managerOnly: true, run: saveCampaign },
  start_campaign: { managerOnly: true, run: startCampaign },
  pause_campaign: { managerOnly: true, run: (a, b) => pauseCampaign(a, b, true) },
  resume_campaign: { managerOnly: true, run: (a, b) => pauseCampaign(a, b, false) },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const action = ACTIONS[String(body.action ?? "")];
    if (!action) return json({ error: "Unknown action" }, 400);
    const admin = await requireActiveAdmin(req, action.managerOnly ? { roles: MANAGER_ROLES } : {});
    return json(await action.run(admin, body));
  } catch (error) {
    const authError = authorizationErrorResponse(error, CORS);
    if (authError) return authError;
    if (error instanceof InputError) return json({ error: error.message }, 400);
    console.error("receptionist-admin failed:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
