import { describe, expect, it } from 'vitest';
import {
  ConnectionInputError, ZENNO_WEBHOOK_EVENTS, buildWebhookSettings, isEventForRoute, ownWebhookUrl, readZernioApiKey, webhookRoute,
} from '../../../supabase/functions/_shared/social/zernioConnection';

const CONNECTION = '6a1f3c2e-8b4d-4f1a-9c2e-1d2b3c4d5e6f';

describe('readZernioApiKey', () => {
  it('trims a plausible key', () => {
    expect(readZernioApiKey('  sk_live_abcdefghijklmnop1234  ')).toBe('sk_live_abcdefghijklmnop1234');
  });

  it('rejects empty, short, spaced or non-string keys', () => {
    expect(() => readZernioApiKey('')).toThrow(ConnectionInputError);
    expect(() => readZernioApiKey('short')).toThrow(ConnectionInputError);
    expect(() => readZernioApiKey('sk live with spaces 1234567890')).toThrow(ConnectionInputError);
    expect(() => readZernioApiKey(42)).toThrow(ConnectionInputError);
  });
});

describe('webhookRoute', () => {
  it('uses Zenno\'s own Zernio when there is no connection id', () => {
    expect(webhookRoute(new URL('https://x.supabase.co/functions/v1/social-webhook'))).toEqual({ kind: 'platform' });
  });

  it('routes a shop\'s own Zernio by connection id', () => {
    expect(webhookRoute(new URL(`https://x.supabase.co/functions/v1/social-webhook?c=${CONNECTION}`))).toEqual({ kind: 'own', connectionId: CONNECTION });
  });

  it('rejects a malformed connection id', () => {
    expect(webhookRoute(new URL('https://x.supabase.co/functions/v1/social-webhook?c=../../etc'))).toEqual({ kind: 'invalid' });
  });
});

describe('isEventForRoute', () => {
  it('accepts platform events only for shops without their own Zernio', () => {
    expect(isEventForRoute({ kind: 'platform' }, null)).toBe(true);
    expect(isEventForRoute({ kind: 'platform' }, CONNECTION)).toBe(false);
  });

  it('accepts own-Zernio events only for the shop that owns that connection', () => {
    expect(isEventForRoute({ kind: 'own', connectionId: CONNECTION }, CONNECTION)).toBe(true);
    expect(isEventForRoute({ kind: 'own', connectionId: CONNECTION }, null)).toBe(false);
    expect(isEventForRoute({ kind: 'own', connectionId: CONNECTION }, '00000000-0000-4000-8000-000000000000')).toBe(false);
    expect(isEventForRoute({ kind: 'invalid' }, CONNECTION)).toBe(false);
  });
});

describe('ownWebhookUrl / buildWebhookSettings', () => {
  it('points the shop\'s Zernio at Zenno with its own secret and the events Zenno handles', () => {
    const url = ownWebhookUrl('https://x.supabase.co/', CONNECTION);
    expect(url).toBe(`https://x.supabase.co/functions/v1/social-webhook?c=${CONNECTION}`);
    expect(buildWebhookSettings(url, 's'.repeat(48))).toEqual({ name: 'Zenno', url, secret: 's'.repeat(48), events: ZENNO_WEBHOOK_EVENTS, isActive: true });
    expect(ZENNO_WEBHOOK_EVENTS).toEqual(expect.arrayContaining(['message.received', 'account.connected', 'review.new']));
  });
});
