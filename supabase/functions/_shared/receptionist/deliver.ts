// Sends a reply on the conversation's own channel.
//   web       stored only — the widget picks it up by polling
//   email     SMTP from the shop's own mailbox, threaded to the customer's mail
//   whatsapp  Cloud API or QR gateway, depending on the shop's connection

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { formatSender, sendWithSmtp } from "../smtpSender.ts";
import type { Deliver } from "./agent.ts";
import type { ConversationRow } from "./conversations.ts";
import { replySubject, safeMessageId, textToHtml } from "./emailParse.ts";
import type { ReceptionistSettings } from "./shopContext.ts";
import { cloudSendText, gatewaySendText, WhatsappError } from "./whatsapp.ts";

export async function getSecret(supabase: SupabaseClient, businessId: string, kind: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("receptionist_get_secret", { p_business_id: businessId, p_kind: kind });
  if (error) throw new Error(`secret lookup failed: ${error.message}`);
  return (data as string | null) ?? null;
}

export interface ShopMailbox {
  provider: "smtp" | "resend";
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  api_key: string | null;
  from_email: string;
  from_name: string | null;
}

/** How the shop sends email: its own SMTP mailbox, or Resend (then IMAP needs its own login). */
export async function shopMailbox(supabase: SupabaseClient, businessId: string): Promise<ShopMailbox | null> {
  const { data, error } = await supabase.from("email_settings")
    .select("provider, smtp_host, smtp_port, smtp_username, smtp_password, api_key, from_email, from_name")
    .eq("business_id", businessId).maybeSingle();
  if (error) throw new Error(`email settings lookup failed: ${error.message}`);
  if (!data?.from_email) return null;
  if (data.provider === "smtp") return data as ShopMailbox;
  if (data.provider === "resend" && data.api_key) return data as ShopMailbox;
  return null;
}

async function sendWithResend(mailbox: ShopMailbox, message: { to: string; subject: string; html: string; text: string; headers: Record<string, string>; replyTo: string | null }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${mailbox.api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: formatSender(mailbox.from_email, mailbox.from_name),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend ${response.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return { id: `resend-${body.id ?? crypto.randomUUID()}` };
}

async function lastInboundMessageId(supabase: SupabaseClient, conversationId: string): Promise<string | null> {
  const { data } = await supabase.from("receptionist_messages").select("external_id")
    .eq("conversation_id", conversationId).eq("direction", "in").not("external_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.external_id as string | undefined) ?? null;
}

export function makeDeliver(supabase: SupabaseClient, settings: ReceptionistSettings): Deliver {
  return async (conversation: ConversationRow, body: string) => {
    if (conversation.channel === "web") return {};

    if (conversation.channel === "email") {
      const mailbox = await shopMailbox(supabase, settings.business_id);
      if (!mailbox) throw new Error("No email sending configured for replies");
      const to = conversation.contact_email ?? conversation.external_id;
      const inReplyTo = safeMessageId(await lastInboundMessageId(supabase, conversation.id));
      // Auto-Submitted stops other auto-responders from answering back (mail loops).
      const headers: Record<string, string> = { "Auto-Submitted": "auto-replied" };
      if (inReplyTo) {
        headers["In-Reply-To"] = inReplyTo;
        headers["References"] = inReplyTo;
      }
      const message = { to, subject: replySubject(conversation.subject), html: textToHtml(body), text: body, headers };
      if (mailbox.provider === "resend") {
        // Sent from e.g. noreply@…; answers must reach the mailbox the receptionist reads.
        const readMailbox = settings.imap_username && settings.imap_username.includes("@") ? settings.imap_username : null;
        return { externalId: (await sendWithResend(mailbox, { ...message, replyTo: readMailbox })).id };
      }
      return { externalId: (await sendWithSmtp(mailbox, message)).id };
    }

    const to = conversation.external_id;
    if (settings.whatsapp_provider === "cloud_api") {
      const token = await getSecret(supabase, settings.business_id, "whatsapp_cloud_token");
      if (!token || !settings.whatsapp_phone_number_id) throw new WhatsappError("WhatsApp is not connected");
      return { externalId: await cloudSendText(settings.whatsapp_phone_number_id, token, to, body) };
    }
    if (settings.whatsapp_provider === "qr_gateway" && settings.whatsapp_instance) {
      return { externalId: await gatewaySendText(settings.whatsapp_instance, to, body) };
    }
    throw new WhatsappError("WhatsApp is not connected");
  };
}
