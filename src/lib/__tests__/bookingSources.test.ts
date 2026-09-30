import { describe, test, expect } from 'vitest';
import { summarizeSources } from '../bookingSources';

describe('summarizeSources', () => {
  test('counts channels, puts AI first and untracked last, and names the top assistant', () => {
    // Arrange
    const rows = [
      { channel: 'search' as const, ai_agent: null },
      { channel: 'search' as const, ai_agent: null },
      { channel: 'search' as const, ai_agent: null },
      { channel: null, ai_agent: null },
      { channel: 'ai_booked' as const, ai_agent: 'ChatGPT' },
      { channel: 'ai_referral' as const, ai_agent: 'Perplexity' },
      { channel: 'ai_booked' as const, ai_agent: 'ChatGPT' },
    ];

    // Act
    const summary = summarizeSources(rows);

    // Assert
    expect(summary.total).toBe(7);
    expect(summary.aiTotal).toBe(3);
    expect(summary.topAiAgent).toBe('ChatGPT');
    expect(summary.buckets.map((b) => b.channel)).toEqual(['ai_booked', 'ai_referral', 'search', 'untracked']);
    expect(summary.buckets[0]).toMatchObject({ label: 'Booked by AI assistant', count: 2, isAi: true });
    expect(summary.buckets[2].share).toBeCloseTo(3 / 7);
  });

  test('handles no bookings', () => {
    expect(summarizeSources([])).toEqual({ total: 0, buckets: [], aiTotal: 0, topAiAgent: null });
  });
});
