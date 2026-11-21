import { describe, expect, it, vi } from 'vitest';

vi.mock('../functionAuth', () => ({ adminAccessToken: async () => 'token' }));
vi.mock('../supabase', () => ({ supabase: {} }));

import { postStatus, reviewStatus, starsLabel, toLocalInput, type GbpPost, type GbpReview } from '../../components/admin/social/localSeoApi';
import { isAutomation, starterDraft } from '../../components/admin/marketing/marketingApi';
import { AUTOMATION_STARTERS } from '../../components/admin/marketing/automationText';

const review = (patch: Partial<GbpReview> = {}): GbpReview => ({
  id: 'r1', reviewer_name: 'Anna', rating: 5, comment: 'Toll', reviewed_at: '2026-11-10T09:00:00Z',
  reply_text: null, replied_at: null, reply_source: null, draft_text: null, drafted_at: null, last_error: null, ...patch,
});

describe('reviewStatus', () => {
  it('shows answered, auto-answered, draft ready, failed and open reviews', () => {
    expect(reviewStatus(review({ reply_text: 'Danke', reply_source: 'owner' }))).toBe('replied');
    expect(reviewStatus(review({ reply_text: 'Danke', reply_source: 'auto' }))).toBe('auto');
    expect(reviewStatus(review({ draft_text: 'Danke…' }))).toBe('draft');
    expect(reviewStatus(review({ last_error: 'Google said no' }))).toBe('failed');
    expect(reviewStatus(review())).toBe('open');
  });
});

describe('starsLabel', () => {
  it('draws filled and empty stars', () => {
    expect(starsLabel(4)).toBe('★★★★☆');
    expect(starsLabel(0)).toBe('☆☆☆☆☆');
  });
});

describe('postStatus', () => {
  const post = (patch: Partial<GbpPost>): GbpPost => ({
    id: 'p1', content: 'Hi', topic: null, cta_type: null, cta_url: null, status: 'draft', scheduled_for: null,
    published_at: null, post_url: null, last_error: null, created_at: '2026-11-13T10:00:00Z', ...patch,
  });
  it('treats published posts older than 7 days as faded', () => {
    const now = new Date('2026-11-20T10:00:00Z');
    expect(postStatus(post({ status: 'published', published_at: '2026-11-12T10:00:00Z' }), now)).toBe('faded');
    expect(postStatus(post({ status: 'published', published_at: '2026-11-15T10:00:00Z' }), now)).toBe('published');
    expect(postStatus(post({ status: 'scheduled', scheduled_for: '2026-11-21T10:00:00Z' }), now)).toBe('scheduled');
    expect(postStatus(post({}), now)).toBe('draft');
  });
});

describe('toLocalInput', () => {
  it('formats a date for a datetime-local field in local time', () => {
    const value = toLocalInput(new Date(2026, 10, 17, 9, 5));
    expect(value).toBe('2026-11-17T09:05');
  });
});

describe('review request automation', () => {
  it('is an automation whose button opens the Google review link and goes to subscribers only', () => {
    expect(isAutomation('review_request')).toBe(true);
    const draft = starterDraft('review_request', AUTOMATION_STARTERS.de.review_request, 'https://search.google.com/local/writereview?placeid=X');
    expect(draft.audience).toBe('subscribers');
    expect(draft.days_after).toBe(1);
    expect(draft.blocks[0]).toMatchObject({ type: 'hero', buttonUrl: 'https://search.google.com/local/writereview?placeid=X' });
  });
});

describe('postStatus for scheduled posts', () => {
  it('counts a scheduled post as live once its time has passed', () => {
    const post: GbpPost = {
      id: 'p2', content: 'Hi', topic: null, cta_type: null, cta_url: null, status: 'scheduled', scheduled_for: '2026-11-14T09:00:00Z',
      published_at: null, post_url: null, last_error: null, created_at: '2026-11-13T10:00:00Z',
    };
    expect(postStatus(post, new Date('2026-11-14T08:00:00Z'))).toBe('scheduled');
    expect(postStatus(post, new Date('2026-11-15T08:00:00Z'))).toBe('published');
    expect(postStatus(post, new Date('2026-11-25T08:00:00Z'))).toBe('faded');
  });
});
