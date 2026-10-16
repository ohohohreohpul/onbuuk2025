import { supabase } from '../../../lib/supabase';

// Writes go through the receptionist-admin edge function; reads use the
// tables directly (RLS: admins read their own shop).

export type ChannelMode = 'auto' | 'drafts';
export type Personality = 'warm' | 'calm' | 'cheerful' | 'professional';
export type EmojiStyle = 'never' | 'mirror' | 'sometimes';
export type ReplyLength = 'short' | 'balanced' | 'detailed';
export type Initiative = 'answer' | 'guide' | 'sell';
export type Habit = 'introduce_self' | 'ask_needs_first' | 'recommend' | 'use_name' | 'mention_promotion' | 'suggest_gift' | 'offer_alternatives' | 'aftercare';
export interface Briefing {
  personality: Personality;
  emoji: EmojiStyle;
  length: ReplyLength;
  initiative: Initiative;
  habits: Habit[];
  briefing: string;
}
export type ChannelKey = 'web' | 'email' | 'whatsapp';

export interface ReceptionistSettings {
  business_id: string;
  is_enabled: boolean;
  assistant_name: string;
  address_form: 'sie' | 'du';
  faq: { question: string; answer: string }[];
  playbook: Partial<Briefing>;
  web_enabled: boolean;
  web_mode: ChannelMode;
  widget_key: string;
  widget_greeting: string;
  widget_color: string | null;
  email_enabled: boolean;
  email_mode: ChannelMode;
  imap_host: string | null;
  imap_port: number;
  imap_username: string | null;
  imap_checked_at: string | null;
  imap_error: string | null;
  whatsapp_enabled: boolean;
  whatsapp_mode: ChannelMode;
  whatsapp_provider: 'cloud_api' | 'qr_gateway' | null;
  whatsapp_status: 'disconnected' | 'pending_qr' | 'connected' | 'error';
  whatsapp_display_phone: string | null;
  whatsapp_phone_number_id: string | null;
}

export interface Overview {
  settings: ReceptionistSettings;
  whatsappQr: string | null;
  status: {
    aiConfigured: boolean;
    jevConfigured: boolean;
    qrGatewayAvailable: boolean;
    mailbox: { address: string; smtpHost: string | null; provider: 'smtp' | 'resend' } | null;
    hasCloudToken: boolean;
    needsHuman: number;
    drafts: number;
    tokensThisMonth: number;
    shopName?: string | null;
  };
}

export interface Conversation {
  id: string;
  channel: ChannelKey;
  external_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  subject: string | null;
  status: 'open' | 'needs_human' | 'closed';
  needs_human_reason: string | null;
  is_ai_paused: boolean;
  unread_count: number;
  last_message_at: string;
}

export interface Message {
  id: string;
  direction: 'in' | 'out';
  author: 'customer' | 'ai' | 'staff' | 'system';
  body: string;
  status: 'sent' | 'draft' | 'failed' | 'discarded';
  meta: { actions?: { tool: string; result: string }[]; handed_over?: string | null; kind?: string };
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  is_personalised: boolean;
  template_name: string | null;
  template_language: string | null;
  status: 'draft' | 'sending' | 'paused' | 'done';
  recipient_count: number;
  created_at: string;
}

export class ReceptionistApiError extends Error {}

/** Calls the admin function; turns its { error } body into a readable Error. */
export async function callReceptionist<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('receptionist-admin', { body: { action, ...payload } });
  if (error) {
    const context = (error as { context?: Response }).context;
    const body = context ? await context.json().catch(() => null) : null;
    throw new ReceptionistApiError(body?.error ?? error.message);
  }
  if (data?.error) throw new ReceptionistApiError(data.error);
  return data as T;
}

export const loadOverview = () => callReceptionist<Overview>('overview');
export const suggestStyle = (url: string, language: string) =>
  callReceptionist<{ suggestion: Omit<Briefing, 'habits'> }>('suggest_style', { url, language });

export const updateSettings = (patch: Partial<ReceptionistSettings>) => callReceptionist<Overview>('update_settings', { patch });

export type InboxFilter = 'all' | 'needs_human' | ChannelKey;

const PREVIEW_WINDOW = 400;

/** Conversations (newest first) with the last message as a preview line. */
export async function loadConversations(businessId: string, filter: InboxFilter): Promise<(Conversation & { preview: string | null })[]> {
  let query = supabase.from('receptionist_conversations')
    .select('id, channel, external_id, contact_name, contact_email, contact_phone, subject, status, needs_human_reason, is_ai_paused, unread_count, last_message_at')
    .eq('business_id', businessId).order('last_message_at', { ascending: false }).limit(100);
  if (filter === 'needs_human') query = query.eq('status', 'needs_human');
  else if (filter !== 'all') query = query.eq('channel', filter);
  const { data, error } = await query;
  if (error) throw error;
  const conversations = (data ?? []) as Conversation[];
  if (conversations.length === 0) return [];
  const { data: recent } = await supabase.from('receptionist_messages').select('conversation_id, body, author')
    .in('conversation_id', conversations.map((c) => c.id)).in('status', ['sent', 'draft']).neq('author', 'system')
    .order('created_at', { ascending: false }).limit(PREVIEW_WINDOW);
  const previews = new Map<string, string>();
  for (const m of recent ?? []) if (!previews.has(m.conversation_id)) previews.set(m.conversation_id, m.body as string);
  return conversations.map((c) => ({ ...c, preview: previews.get(c.id) ?? null }));
}

export async function loadMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('receptionist_messages')
    .select('id, direction, author, body, status, meta, created_at')
    .eq('conversation_id', conversationId).neq('status', 'discarded').order('created_at').limit(200);
  if (error) throw error;
  return (data ?? []) as Message[];
}

/** Conversation ids that have a draft waiting for approval. */
export async function loadDraftConversationIds(businessId: string): Promise<Set<string>> {
  const { data } = await supabase.from('receptionist_messages').select('conversation_id').eq('business_id', businessId).eq('status', 'draft');
  return new Set((data ?? []).map((row) => row.conversation_id as string));
}

export async function loadCampaigns(businessId: string): Promise<(Campaign & { sent: number; failed: number })[]> {
  const [campaigns, recipients] = await Promise.all([
    supabase.from('outreach_campaigns').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    supabase.from('outreach_recipients').select('campaign_id, status').eq('business_id', businessId),
  ]);
  if (campaigns.error) throw campaigns.error;
  const counts = new Map<string, { sent: number; failed: number }>();
  for (const r of recipients.data ?? []) {
    const entry = counts.get(r.campaign_id) ?? { sent: 0, failed: 0 };
    if (r.status === 'sent') entry.sent++;
    if (r.status === 'failed' || r.status === 'skipped') entry.failed++;
    counts.set(r.campaign_id, entry);
  }
  return ((campaigns.data ?? []) as Campaign[]).map((c) => ({ ...c, ...(counts.get(c.id) ?? { sent: 0, failed: 0 }) }));
}

export async function countConsents(businessId: string): Promise<number> {
  const { count } = await supabase.from('customer_contact_consents').select('id', { count: 'exact', head: true })
    .eq('business_id', businessId).eq('channel', 'whatsapp').eq('status', 'granted');
  return count ?? 0;
}
