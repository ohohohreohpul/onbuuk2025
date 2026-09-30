// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  classifyVisit,
  hostOf,
  aiAgentFor,
  captureAttribution,
  bookingAttribution,
  ADMIN_ATTRIBUTION,
} from '../attribution';

const OWN = 'mira.zennohq.com';
const visit = (search: string, referrer: string | null = null) => classifyVisit({ search, referrer, ownHost: OWN });

describe('classifyVisit', () => {
  test('ChatGPT links (utm_source=chatgpt.com) count as AI referrals', () => {
    expect(visit('?utm_source=chatgpt.com')).toMatchObject({ channel: 'ai_referral', ai_agent: 'ChatGPT', utm_source: 'chatgpt.com' });
  });

  test('AI referrers without UTM are recognised', () => {
    expect(visit('', 'https://www.perplexity.ai/search?q=x')).toMatchObject({ channel: 'ai_referral', ai_agent: 'Perplexity', referrer_host: 'perplexity.ai' });
    expect(visit('', 'https://gemini.google.com/app')).toMatchObject({ channel: 'ai_referral', ai_agent: 'Gemini' });
  });

  test('search, social, email, referral and direct', () => {
    expect(visit('', 'https://www.google.de/')).toMatchObject({ channel: 'search', referrer_host: 'google.de' });
    expect(visit('?utm_source=google&utm_medium=cpc')).toMatchObject({ channel: 'search' });
    expect(visit('', 'https://l.instagram.com/')).toMatchObject({ channel: 'social' });
    expect(visit('?utm_source=IG')).toMatchObject({ channel: 'social', utm_source: 'ig' });
    expect(visit('?utm_source=mailchimp&utm_medium=Email&utm_campaign=Oktober')).toMatchObject({ channel: 'email', utm_campaign: 'oktober' });
    expect(visit('', 'https://hamburg-blog.de/beste-salons')).toMatchObject({ channel: 'referral', referrer_host: 'hamburg-blog.de' });
    expect(visit('')).toMatchObject({ channel: 'direct', referrer_host: null });
  });

  test('navigation inside the shop itself is not a referral', () => {
    expect(visit('', `https://${OWN}/services`)).toMatchObject({ channel: 'direct', referrer_host: null });
  });
});

describe('helpers', () => {
  test('hostOf handles missing and invalid URLs', () => {
    expect(hostOf('https://www.Google.com/x')).toBe('google.com');
    expect(hostOf('not a url')).toBeNull();
    expect(hostOf(null)).toBeNull();
  });
  test('aiAgentFor ignores unknown sources', () => {
    expect(aiAgentFor('claude.ai')).toBe('Claude');
    expect(aiAgentFor('example.com')).toBeNull();
    expect(aiAgentFor(null)).toBeNull();
  });
});

describe('capture and read (session storage)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/?utm_source=chatgpt.com');
  });

  test('keeps the first touch of the visit', () => {
    captureAttribution();
    window.history.replaceState({}, '', '/?utm_source=instagram');
    captureAttribution();
    expect(bookingAttribution()).toMatchObject({ channel: 'ai_referral', ai_agent: 'ChatGPT' });
  });

  test('defaults to direct when nothing was captured or storage fails', () => {
    expect(bookingAttribution().channel).toBe('direct');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(bookingAttribution().channel).toBe('direct');
    expect(() => captureAttribution()).not.toThrow();
    vi.restoreAllMocks();
  });

  test('admin bookings are labelled admin', () => {
    expect(ADMIN_ATTRIBUTION.channel).toBe('admin');
  });
});
