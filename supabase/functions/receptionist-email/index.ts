import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { publicServiceClient } from "../_shared/agentAuth.ts";
import { isServiceRoleRequest } from "../_shared/adminAuthorization.ts";
import { handleInbound } from "../_shared/receptionist/agent.ts";
import { getSecret, makeDeliver, shopMailbox } from "../_shared/receptionist/deliver.ts";
import { parseEmail } from "../_shared/receptionist/emailParse.ts";
import { ImapClient, ImapError } from "../_shared/receptionist/imap.ts";
import type { ReceptionistSettings } from "../_shared/receptionist/shopContext.ts";

// Cron (every minute, pg_cron + x-cron-secret): reads new mails from each
// shop's own mailbox over IMAP and lets the receptionist reply (or draft).
// The first run of a mailbox only remembers where the inbox stands — old mail
// is never answered.

const MAX_MAILS_PER_SHOP = 5;
const TIME_BUDGET_MS = 50_000;
const PER_SHOP_TIMEOUT_MS = 25_000;

type Client = ReturnType<typeof publicServiceClient>;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("OUTBOX_CRON_SECRET") ?? "";
  return (secret.length >= 32 && timingSafeEqual(req.headers.get("x-cron-secret") ?? "", secret)) || isServiceRoleRequest(req);
}

async function saveState(supabase: Client, businessId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("receptionist_settings").update(patch).eq("business_id", businessId);
  if (error) console.error("imap state update failed:", error);
}

async function pollShop(supabase: Client, settings: ReceptionistSettings, deadline: number): Promise<number> {
  const mailbox = await shopMailbox(supabase, settings.business_id);
  if (!mailbox || !settings.imap_host) throw new ImapError("Mailbox not configured (email sending + IMAP server needed)");
  const username = settings.imap_username || mailbox.smtp_username;
  const password = (await getSecret(supabase, settings.business_id, "imap_password")) || mailbox.smtp_password;
  if (!username || !password) throw new ImapError("Mailbox user name or password missing");
  const ownAddresses = new Set([mailbox.from_email, username].map((a) => String(a).toLowerCase()));

  const client = new ImapClient();
  let handled = 0;
  try {
    await client.connect(settings.imap_host, settings.imap_port);
    await client.login(username, password);
    const { uidValidity, uidNext } = await client.selectInbox();

    if (!settings.imap_last_uid || (uidValidity && settings.imap_uidvalidity && uidValidity !== settings.imap_uidvalidity)) {
      await saveState(supabase, settings.business_id, {
        imap_uidvalidity: uidValidity, imap_last_uid: Math.max((uidNext ?? 1) - 1, 1), imap_checked_at: new Date().toISOString(), imap_error: null,
      });
      return 0;
    }

    const deliver = makeDeliver(supabase, settings);
    const uids = (await client.searchUidsAfter(settings.imap_last_uid)).slice(0, MAX_MAILS_PER_SHOP);
    for (const uid of uids) {
      if (Date.now() > deadline) break;
      const raw = await client.fetchRaw(uid);
      // Remember progress first: a mail that crashes the agent is not retried forever.
      await saveState(supabase, settings.business_id, { imap_last_uid: uid, imap_uidvalidity: uidValidity });
      if (!raw) continue;
      const mail = await parseEmail(raw);
      if (mail.isAutomated || !mail.fromAddress || ownAddresses.has(mail.fromAddress) || !mail.body) continue;
      await handleInbound(supabase, settings, {
        channel: "email",
        externalId: mail.fromAddress,
        body: mail.subject ? `Subject: ${mail.subject}\n\n${mail.body}` : mail.body,
        externalMessageId: mail.messageId,
        contact: { name: mail.fromName, email: mail.fromAddress, subject: mail.subject },
        isVerifiedSender: mail.isSenderVerified,
      }, deliver);
      handled++;
    }
    await saveState(supabase, settings.business_id, { imap_checked_at: new Date().toISOString(), imap_error: null });
    return handled;
  } finally {
    await client.logout();
  }
}

Deno.serve(async (req) => {
  if (!isAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const supabase = publicServiceClient();
  const deadline = Date.now() + TIME_BUDGET_MS;
  const { data, error } = await supabase.from("receptionist_settings").select("*")
    .eq("is_enabled", true).eq("email_enabled", true).not("imap_host", "is", null);
  if (error) {
    console.error("receptionist-email: settings lookup failed", error);
    return new Response(JSON.stringify({ error: "lookup failed" }), { status: 500 });
  }
  const results: Record<string, number | string> = {};
  for (const settings of (data ?? []) as ReceptionistSettings[]) {
    if (Date.now() > deadline) break;
    try {
      // One slow or hostile mail server must not block the other shops.
      results[settings.business_id] = await Promise.race([
        pollShop(supabase, settings, Math.min(deadline, Date.now() + PER_SHOP_TIMEOUT_MS)),
        new Promise<never>((_, reject) => setTimeout(() => reject(new ImapError("Mail server too slow")), PER_SHOP_TIMEOUT_MS + 2_000)),
      ]);
    } catch (pollError) {
      const message = (pollError instanceof Error ? pollError.message : String(pollError)).slice(0, 300);
      console.error(`receptionist-email: ${settings.business_id}`, message);
      results[settings.business_id] = message;
      await saveState(supabase, settings.business_id, { imap_checked_at: new Date().toISOString(), imap_error: message });
    }
  }
  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
