import { supabase } from '../../../lib/supabase';

export type Audience = 'subscribers' | 'all';

export interface Campaign {
  id: string;
  business_id: string;
  subject: string;
  body: string;
  button_text: string | null;
  button_url: string | null;
  audience: Audience;
  day_of_month: number;
  send_hour: number;
  is_active: boolean;
  next_send_at: string | null;
  last_queued_at: string | null;
}

export type CampaignDraft = Omit<Campaign, 'id' | 'business_id' | 'next_send_at' | 'last_queued_at'>;

export interface AudienceCounts {
  subscribers: number;
  all: number;
  unsubscribed: number;
}

export interface RunSummary {
  runKey: string;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  lastAt: string;
}

export const EMPTY_DRAFT: CampaignDraft = {
  subject: '',
  body: '',
  button_text: null,
  button_url: null,
  audience: 'subscribers',
  day_of_month: 1,
  send_hour: 10,
  is_active: false,
};

export async function loadCampaigns(businessId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Campaign[];
}

export async function loadAudienceCounts(): Promise<AudienceCounts> {
  const { data, error } = await supabase.rpc('marketing_audience_counts');
  if (error) throw error;
  return { subscribers: 0, all: 0, unsubscribed: 0, ...(data as Partial<AudienceCounts>) };
}

/** Insert or update; returns the saved row (next_send_at is computed by the database). */
export async function saveCampaign(businessId: string, id: string | null, draft: CampaignDraft): Promise<Campaign> {
  const row = { ...draft, business_id: businessId, button_text: draft.button_text || null, button_url: draft.button_url || null };
  const query = id
    ? supabase.from('marketing_campaigns').update(row).eq('id', id)
    : supabase.from('marketing_campaigns').insert(row);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data as Campaign;
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
  if (error) throw error;
}

export async function sendTest(campaignId: string, testEmail: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('send-marketing', { body: { campaignId, testEmail } });
  if (error || !data?.success) throw new Error(data?.error || error?.message || 'send failed');
}

/** Queues the campaign for its audience right away; returns the number of recipients. */
export async function sendNow(campaignId: string): Promise<number> {
  const { data, error } = await supabase.rpc('send_campaign_now', { p_campaign_id: campaignId });
  if (error) throw error;
  return Number(data ?? 0);
}

const RUN_HISTORY_LIMIT = 10000;

export async function loadRuns(campaignId: string): Promise<RunSummary[]> {
  const { data, error } = await supabase
    .from('marketing_sends')
    .select('run_key, status, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(RUN_HISTORY_LIMIT);
  if (error) throw error;
  const runs = new Map<string, RunSummary>();
  for (const row of data ?? []) {
    const run = runs.get(row.run_key) ?? { runKey: row.run_key, sent: 0, failed: 0, pending: 0, skipped: 0, lastAt: row.created_at };
    if (row.status === 'sent') run.sent += 1;
    else if (row.status === 'failed') run.failed += 1;
    else if (row.status === 'skipped') run.skipped += 1;
    else run.pending += 1;
    runs.set(row.run_key, run);
  }
  return [...runs.values()];
}
