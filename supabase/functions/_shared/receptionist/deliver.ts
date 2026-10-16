// Sends a reply on the conversation's own channel.
//   web       stored only — the widget picks it up by polling
//   email     SMTP from the shop's own mailbox, threaded to the customer's mail
//   whatsapp  Cloud API or QR gateway, depending on the shop's connection

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendWithSmtp } from "../smtpSender.ts";
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

/** SMTP settings of the shop's mailbox (the same mailbox IMAP reads). */
export async function shopMailbox(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase.from("email_settings")
    .select("provider, smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name")
    .eq("business_id", businessId).maybeSingle();
  if (error) throw new Error(`email settings lookup failed: ${error.message}`);
  if (!data || data.provider !== "smtp" || !data.from_email) return null;
  return data;
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
      if (!mailbox) throw new Error("No SMTP mailbox configured for replies");
      const to = conversation.contact_email ?? conversation.external_id;
      const inReplyTo = safeMessageId(await lastInboundMessageId(supabase, conversation.id));
      // Auto-Submitted stops other auto-responders from answering back (mail loops).
      const headers: Record<string, string> = { "Auto-Submitted": "auto-replied" };
      if (inReplyTo) {
        headers["In-Reply-To"] = inReplyTo;
        headers["References"] = inReplyTo;
      }
      const sent = await sendWithSmtp(mailbox, { to, subject: replySubject(conversation.subject), html: textToHtml(body), text: body, headers });
      return { externalId: sent.id };
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
