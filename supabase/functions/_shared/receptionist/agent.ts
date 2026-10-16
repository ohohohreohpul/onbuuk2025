// The AI receptionist's turn: load the shop, think with tools, then send the
// reply or keep it as a draft for the team. Channel adapters only parse
// inbound messages and deliver outbound text; everything else lives here.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { complete, isLlmConfigured, LlmError, type ChatMessage } from "./llm.ts";
import { humanizeText } from "./humanize.ts";
import { buildSystemPrompt, type Channel } from "./prompt.ts";
import { loadShopContext, type ReceptionistSettings } from "./shopContext.ts";
import { newOutcome, runTool, TOOL_SCHEMAS, type ToolOutcome, type ToolRun } from "./tools.ts";
import { isOverTokenBudget, phoneTailPattern, withinLimit } from "./limits.ts";
import {
  appendMessage, recentHistory, updateConversation, upsertConversation, type ContactDetails, type ConversationRow, type MessageRow,
} from "./conversations.ts";

const MAX_TOOL_ROUNDS = 6;
const TRANSCRIPT_MESSAGES = 6;
const FALLBACK_REPLY = "Thank you for your message — a team member will get back to you shortly.";
const OPT_OUT = /^\s*(stop|stopp|stop all|abmelden|abbestellen|unsubscribe|keine (werbung|nachrichten)( mehr)?|ยกเลิก|หยุด)\b[\s.!]*(bitte|please)?[\s.!]*$/i;
const SENDER_LIMIT_PER_HOUR = 20;
const HOUR_SECONDS = 3600;

export interface AgentReply {
  text: string;
  outcome: ToolOutcome;
  usage: { model: string; promptTokens: number; completionTokens: number };
}

export interface Inbound {
  channel: Channel;
  externalId: string; // conversation key: visitor id | email address | phone digits
  body: string;
  externalMessageId?: string | null;
  contact?: ContactDetails;
  meta?: Record<string, unknown>;
  /** WhatsApp: always (number comes from the provider). Email: only with DKIM/SPF/DMARC pass. Web: never. */
  isVerifiedSender?: boolean;
}

/** Sends a reply on the conversation's channel; returns the provider's message id if any. */
export type Deliver = (conversation: ConversationRow, body: string) => Promise<{ externalId?: string | null }>;

export interface InboundResult {
  conversation: ConversationRow;
  reply: MessageRow | null;
  duplicate: boolean;
}

function toChat(history: MessageRow[]): ChatMessage[] {
  return history.map((m) => (m.direction === "in"
    ? { role: "user" as const, content: m.body }
    : { role: "assistant" as const, content: m.body }));
}

function transcriptOf(history: MessageRow[]): string {
  return history.slice(-TRANSCRIPT_MESSAGES).map((m) => `${m.direction === "in" ? "Customer" : "Assistant"}: ${m.body}`).join("\n");
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** One agent turn over the stored history (the newest inbound message must already be stored). */
export async function runAgent(
  supabase: SupabaseClient,
  settings: ReceptionistSettings,
  conversation: ConversationRow,
  options: { isVerifiedSender: boolean; now?: Date } = { isVerifiedSender: false },
): Promise<AgentReply> {
  const now = options.now ?? new Date();
  const [shop, history] = await Promise.all([loadShopContext(supabase, settings), recentHistory(supabase, conversation.id)]);
  const run: ToolRun = {
    supabase,
    shop,
    conversation: {
      id: conversation.id,
      channel: conversation.channel,
      contactName: conversation.contact_name,
      contactEmail: conversation.contact_email,
      contactPhone: conversation.contact_phone,
      isVerified: options.isVerifiedSender,
    },
    transcript: transcriptOf(history),
    outcome: newOutcome(),
  };
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(shop, {
        channel: conversation.channel,
        contactName: conversation.contact_name,
        contactEmail: conversation.contact_email,
        contactPhone: conversation.contact_phone,
        memory: conversation.memory,
        isVerified: options.isVerifiedSender,
      }, now),
    },
    ...toChat(history),
  ];

  const usage = { model: "", promptTokens: 0, completionTokens: 0 };
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await complete(messages, TOOL_SCHEMAS);
    usage.model = result.model;
    usage.promptTokens += result.usage.promptTokens;
    usage.completionTokens += result.usage.completionTokens;
    const calls = result.message.tool_calls ?? [];
    if (calls.length === 0) {
      const text = humanizeText(result.message.content ?? "");
      return { text: text || FALLBACK_REPLY, outcome: run.outcome, usage };
    }
    messages.push({ role: "assistant", content: result.message.content, tool_calls: calls });
    for (const call of calls) {
      const output = await runTool(run, call.function.name, parseArgs(call.function.arguments));
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
    }
  }
  run.outcome.handedOver ??= { reason: "The assistant could not finish this request" };
  return { text: FALLBACK_REPLY, outcome: run.outcome, usage };
}

async function recordUsage(supabase: SupabaseClient, businessId: string, conversationId: string | null, purpose: "reply" | "outreach" | "test", usage: AgentReply["usage"]) {
  const { error } = await supabase.from("receptionist_usage").insert({
    business_id: businessId, conversation_id: conversationId, purpose, model: usage.model || "unknown",
    prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens,
  });
  if (error) console.error("usage insert failed:", error);
}

async function applyOutcome(supabase: SupabaseClient, conversation: ConversationRow, outcome: ToolOutcome): Promise<ConversationRow> {
  const patch: Partial<ConversationRow> = {};
  if (outcome.memory) patch.memory = outcome.memory;
  if (outcome.contact.name && !conversation.contact_name) patch.contact_name = outcome.contact.name;
  if (outcome.contact.email && !conversation.contact_email) patch.contact_email = outcome.contact.email;
  if (outcome.contact.phone && !conversation.contact_phone) patch.contact_phone = outcome.contact.phone;
  if (outcome.handedOver) {
    patch.status = "needs_human";
    patch.needs_human_reason = outcome.handedOver.reason;
    patch.is_ai_paused = true; // the team takes over; the AI does not talk over them
  }
  if (outcome.optOut && conversation.channel === "whatsapp") await revokeWhatsappConsent(supabase, conversation);
  if (Object.keys(patch).length) await updateConversation(supabase, conversation.id, patch);
  return { ...conversation, ...patch };
}

function channelMode(settings: ReceptionistSettings, channel: Channel): "auto" | "drafts" {
  if (channel === "email") return settings.email_mode;
  if (channel === "whatsapp") return settings.whatsapp_mode;
  return settings.web_mode;
}

function isChannelOn(settings: ReceptionistSettings, channel: Channel): boolean {
  if (!settings.is_enabled) return false;
  if (channel === "email") return settings.email_enabled;
  if (channel === "whatsapp") return settings.whatsapp_enabled;
  return settings.web_enabled;
}

async function revokeWhatsappConsent(supabase: SupabaseClient, conversation: ConversationRow) {
  const pattern = phoneTailPattern(conversation.external_id);
  if (!pattern) return;
  const tail = conversation.external_id.replace(/\D/g, "").slice(-9);
  const { data: customers, error } = await supabase.from("customers").select("id, phone")
    .eq("business_id", conversation.business_id).ilike("phone", pattern).limit(50);
  if (error) {
    console.error("opt-out lookup failed:", error);
    return;
  }
  const matches = ((customers ?? []) as { id: string; phone: string }[]).filter((c) => c.phone.replace(/\D/g, "").endsWith(tail));
  for (const customer of matches) {
    await supabase.from("customer_contact_consents").upsert({
      business_id: conversation.business_id, customer_id: customer.id, channel: "whatsapp", status: "revoked",
      source: "opt_out", evidence: "Customer asked on WhatsApp to stop messages", recorded_at: new Date().toISOString(),
    }, { onConflict: "business_id,customer_id,channel" });
  }
}

/** Sends (or drafts) a reply text on a conversation and stores it. */
export async function sendReply(
  supabase: SupabaseClient,
  conversation: ConversationRow,
  body: string,
  author: "ai" | "staff",
  deliver: Deliver,
  meta: Record<string, unknown> = {},
): Promise<MessageRow | null> {
  try {
    const sent = await deliver(conversation, body);
    return await appendMessage(supabase, conversation, { direction: "out", author, body, status: "sent", externalId: sent.externalId ?? null, meta });
  } catch (error) {
    console.error(`delivery on ${conversation.channel} failed:`, error);
    await updateConversation(supabase, conversation.id, { status: "needs_human", needs_human_reason: "A reply could not be delivered" });
    return appendMessage(supabase, conversation, { direction: "out", author, body, status: "failed", meta: { ...meta, error: String(error).slice(0, 300) } });
  }
}

/** Full inbound pipeline: store → (opt-out) → agent → send or draft. */
export async function handleInbound(
  supabase: SupabaseClient,
  settings: ReceptionistSettings,
  inbound: Inbound,
  deliver: Deliver,
): Promise<InboundResult> {
  let conversation = await upsertConversation(supabase, settings.business_id, inbound.channel, inbound.externalId, inbound.contact ?? {});
  const stored = await appendMessage(supabase, conversation, {
    direction: "in", author: "customer", body: inbound.body, externalId: inbound.externalMessageId, meta: inbound.meta,
  });
  if (!stored) return { conversation, reply: null, duplicate: true };

  if (inbound.channel === "whatsapp" && OPT_OUT.test(inbound.body)) {
    await revokeWhatsappConsent(supabase, conversation);
    const confirmation = "Okay — you will not receive any more promotional messages from us. / Alles klar – Sie erhalten keine Werbenachrichten mehr.";
    return { conversation, reply: await sendReply(supabase, conversation, confirmation, "ai", deliver, { kind: "opt_out" }), duplicate: false };
  }

  if (!isChannelOn(settings, inbound.channel) || conversation.is_ai_paused || !isLlmConfigured()) {
    return { conversation, reply: null, duplicate: false };
  }
  // Per-sender cap on email/WhatsApp (also stops two auto-responders ping-ponging).
  if (inbound.channel !== "web"
    && !(await withinLimit(supabase, `sender:${inbound.channel}:${settings.business_id}:${inbound.externalId}`, HOUR_SECONDS, SENDER_LIMIT_PER_HOUR))) {
    await updateConversation(supabase, conversation.id, { status: "needs_human", needs_human_reason: "Many messages from this sender – the AI stopped answering for now" });
    return { conversation, reply: null, duplicate: false };
  }
  if (await isOverTokenBudget(supabase, settings.business_id)) {
    await updateConversation(supabase, conversation.id, { status: "needs_human", needs_human_reason: "Daily AI limit reached" });
    return { conversation, reply: null, duplicate: false };
  }

  let answer: AgentReply;
  try {
    answer = await runAgent(supabase, settings, conversation, { isVerifiedSender: inbound.isVerifiedSender === true });
  } catch (error) {
    console.error("receptionist agent failed:", error);
    const reason = error instanceof LlmError ? "The AI could not answer (provider error)" : "The AI could not answer";
    await updateConversation(supabase, conversation.id, { status: "needs_human", needs_human_reason: reason });
    await appendMessage(supabase, conversation, { direction: "out", author: "system", body: reason, status: "sent" });
    return { conversation, reply: null, duplicate: false };
  }

  await recordUsage(supabase, settings.business_id, conversation.id, "reply", answer.usage);
  conversation = await applyOutcome(supabase, conversation, answer.outcome);
  const meta = { actions: answer.outcome.actions, handed_over: answer.outcome.handedOver?.reason ?? null };

  // Drafts only: the team sends. A hand-over still answers right away ("a team member will reply").
  if (channelMode(settings, inbound.channel) === "drafts" && !answer.outcome.handedOver && answer.outcome.actions.length === 0) {
    const draft = await appendMessage(supabase, conversation, { direction: "out", author: "ai", body: answer.text, status: "draft", meta });
    return { conversation, reply: draft, duplicate: false };
  }
  return { conversation, reply: await sendReply(supabase, conversation, answer.text, "ai", deliver, meta), duplicate: false };
}
