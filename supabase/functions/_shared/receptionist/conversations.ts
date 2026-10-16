// Conversation + message storage for the AI receptionist.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Channel } from "./prompt.ts";

const HISTORY_LIMIT = 20;
const UNIQUE_VIOLATION = "23505";

export interface ConversationRow {
  id: string;
  business_id: string;
  channel: Channel;
  external_id: string;
  customer_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  subject: string | null;
  status: "open" | "needs_human" | "closed";
  needs_human_reason: string | null;
  is_ai_paused: boolean;
  memory: string;
  unread_count: number;
}

export interface MessageRow {
  id: string;
  direction: "in" | "out";
  author: "customer" | "ai" | "staff" | "system";
  body: string;
  status: "sent" | "draft" | "failed" | "discarded";
  meta: Record<string, unknown>;
  created_at: string;
}

export interface ContactDetails {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
}

const clip = (value: string | null | undefined, max: number) => (value ? value.trim().slice(0, max) || null : null);

/** Finds or creates the conversation; fills contact fields that were still empty. */
export async function upsertConversation(
  supabase: SupabaseClient,
  businessId: string,
  channel: Channel,
  externalId: string,
  contact: ContactDetails,
): Promise<ConversationRow> {
  const { data: existing, error } = await supabase.from("receptionist_conversations").select("*")
    .eq("business_id", businessId).eq("channel", channel).eq("external_id", externalId).maybeSingle();
  if (error) throw new Error(`conversation lookup failed: ${error.message}`);

  if (existing) {
    const row = existing as ConversationRow;
    const patch: Record<string, string> = {};
    if (!row.contact_name && contact.name) patch.contact_name = clip(contact.name, 120)!;
    if (!row.contact_email && contact.email) patch.contact_email = clip(contact.email.toLowerCase(), 254)!;
    if (!row.contact_phone && contact.phone) patch.contact_phone = clip(contact.phone, 40)!;
    if (contact.subject) patch.subject = clip(contact.subject, 300)!;
    if (Object.keys(patch).length === 0) return row;
    const { data } = await supabase.from("receptionist_conversations").update(patch).eq("id", row.id).select("*").single();
    return (data as ConversationRow) ?? row;
  }

  const insert = {
    business_id: businessId,
    channel,
    external_id: externalId.slice(0, 320),
    contact_name: clip(contact.name, 120),
    contact_email: clip(contact.email?.toLowerCase(), 254),
    contact_phone: clip(contact.phone, 40),
    subject: clip(contact.subject, 300),
  };
  const created = await supabase.from("receptionist_conversations").insert(insert).select("*").single();
  if (created.error?.code === UNIQUE_VIOLATION) return upsertConversation(supabase, businessId, channel, externalId, contact);
  if (created.error || !created.data) throw new Error(`conversation insert failed: ${created.error?.message}`);
  return created.data as ConversationRow;
}

/** Stores a message; returns null when a message with the same provider id was already stored (webhook retry). */
export async function appendMessage(
  supabase: SupabaseClient,
  conversation: ConversationRow,
  message: {
    direction: "in" | "out";
    author: MessageRow["author"];
    body: string;
    status?: MessageRow["status"];
    externalId?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<MessageRow | null> {
  const { data, error } = await supabase.from("receptionist_messages").insert({
    conversation_id: conversation.id,
    business_id: conversation.business_id,
    direction: message.direction,
    author: message.author,
    body: message.body.slice(0, 20000),
    status: message.status ?? "sent",
    external_id: message.externalId?.slice(0, 500) ?? null,
    meta: message.meta ?? {},
  }).select("id, direction, author, body, status, meta, created_at").single();
  if (error?.code === UNIQUE_VIOLATION) return null;
  if (error || !data) throw new Error(`message insert failed: ${error?.message}`);

  const patch: Record<string, unknown> = { last_message_at: new Date().toISOString() };
  if (message.direction === "in") patch.unread_count = conversation.unread_count + 1;
  if (message.direction === "in" && conversation.status === "closed") patch.status = "open";
  await supabase.from("receptionist_conversations").update(patch).eq("id", conversation.id);
  return data as MessageRow;
}

/** Last messages the model should see (sent messages and the customer's, oldest first). */
export async function recentHistory(supabase: SupabaseClient, conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase.from("receptionist_messages")
    .select("id, direction, author, body, status, meta, created_at")
    .eq("conversation_id", conversationId).in("status", ["sent"]).neq("author", "system")
    .order("created_at", { ascending: false }).limit(HISTORY_LIMIT);
  if (error) throw new Error(`history lookup failed: ${error.message}`);
  return ((data ?? []) as MessageRow[]).reverse();
}

export async function updateConversation(supabase: SupabaseClient, id: string, patch: Partial<ConversationRow>): Promise<void> {
  const { error } = await supabase.from("receptionist_conversations").update(patch).eq("id", id);
  if (error) console.error("conversation update failed:", error);
}
