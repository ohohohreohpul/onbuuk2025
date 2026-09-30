import type { BookingChannel } from './attribution';

// Aggregates bookings by channel for the "Where your bookings come from"
// dashboard card. Pure — tested by src/lib/__tests__/bookingSources.test.ts.

export interface SourceRow {
  channel: BookingChannel | null;
  ai_agent: string | null;
}

export interface SourceBucket {
  channel: BookingChannel | 'untracked';
  label: string;
  count: number;
  share: number;
  isAi: boolean;
}

export interface SourceSummary {
  total: number;
  buckets: SourceBucket[];
  aiTotal: number;
  topAiAgent: string | null;
}

export const SOURCE_LABELS: Record<SourceBucket['channel'], string> = {
  ai_booked: 'Booked by AI assistant',
  ai_referral: 'From an AI answer',
  search: 'Google & search',
  social: 'Social media',
  email: 'Email',
  referral: 'Other websites',
  direct: 'Direct',
  admin: 'Added by your team',
  untracked: 'Before tracking',
};

const AI_CHANNELS = new Set<SourceBucket['channel']>(['ai_booked', 'ai_referral']);

export function summarizeSources(rows: SourceRow[]): SourceSummary {
  const counts = new Map<SourceBucket['channel'], number>();
  const agents = new Map<string, number>();

  for (const row of rows) {
    const channel = row.channel ?? 'untracked';
    counts.set(channel, (counts.get(channel) ?? 0) + 1);
    if (row.ai_agent && AI_CHANNELS.has(channel)) agents.set(row.ai_agent, (agents.get(row.ai_agent) ?? 0) + 1);
  }

  const total = rows.length;
  const buckets = [...counts.entries()]
    .map(([channel, count]) => ({
      channel,
      label: SOURCE_LABELS[channel],
      count,
      share: total ? count / total : 0,
      isAi: AI_CHANNELS.has(channel),
    }))
    // AI first (it is the story), then by volume; untracked always last.
    .sort((a, b) =>
      Number(b.isAi) - Number(a.isAi) ||
      Number(a.channel === 'untracked') - Number(b.channel === 'untracked') ||
      b.count - a.count,
    );

  const topAiAgent = [...agents.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const aiTotal = buckets.filter((b) => b.isAi).reduce((sum, b) => sum + b.count, 0);
  return { total, buckets, aiTotal, topAiAgent };
}
