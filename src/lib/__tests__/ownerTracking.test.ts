// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import {
  confirmPendingPlan,
  isOwnerSurface,
  queueOwnerEvent,
  readConsent,
  readQueue,
  rememberPendingPlan,
  takeQueuedEvents,
  writeConsent,
} from '../ownerTracking';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('isOwnerSurface', () => {
  test('owner pages on the app host load the pixel', () => {
    for (const path of ['/', '/signup', '/register', '/login', '/signup-success', '/admin', '/admin/', '/de/admin']) {
      expect(isOwnerSurface(path, 'app')).toBe(true);
    }
  });

  test('customer pages on the app host never load it', () => {
    for (const path of ['/booking-success', '/gift-card-success', '/payment-cancelled', '/cancel', '/account', '/sabai-spa', '/staff', '/superadmin']) {
      expect(isOwnerSurface(path, 'app')).toBe(false);
    }
  });

  test('shop and legacy hosts never load it, even on owner-looking paths', () => {
    expect(isOwnerSurface('/', 'shop')).toBe(false);
    expect(isOwnerSurface('/signup', 'shop')).toBe(false);
    expect(isOwnerSurface('/admin', 'legacy-app')).toBe(false);
  });
});

describe('consent', () => {
  test('is unknown until the owner chooses, then remembered', () => {
    expect(readConsent()).toBeNull();
    writeConsent('denied');
    expect(readConsent()).toBe('denied');
    writeConsent('granted');
    expect(readConsent()).toBe('granted');
  });

  test('ignores anything else stored under the key', () => {
    window.localStorage.setItem('zenno-consent', 'maybe');
    expect(readConsent()).toBeNull();
  });
});

describe('event queue', () => {
  test('keeps events until taken, then sends each one once', () => {
    queueOwnerEvent('CompleteRegistration', { content_name: 'email' });
    expect(readQueue()).toHaveLength(1);
    const [event] = takeQueuedEvents();
    expect(event.name).toBe('CompleteRegistration');
    expect(event.eventId).toMatch(/^CompleteRegistration-/);
    expect(takeQueuedEvents()).toEqual([]);
  });

  test('drops corrupted queue data instead of throwing', () => {
    window.sessionStorage.setItem('zenno-owner-events', '{not json');
    expect(readQueue()).toEqual([]);
    window.sessionStorage.setItem('zenno-owner-events', JSON.stringify([{ name: 'Hack' }, 5]));
    expect(readQueue()).toEqual([]);
  });
});

describe('plan purchase', () => {
  test('turns the plan chosen before checkout into one Purchase on success', () => {
    rememberPendingPlan('social', 69);
    confirmPendingPlan();
    confirmPendingPlan(); // a second return (or React StrictMode) must not double-count
    const events = takeQueuedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: 'Purchase', params: { value: 69, currency: 'EUR', content_name: 'social' } });
  });

  test('reports a free trial as one StartTrial, not a Purchase', () => {
    rememberPendingPlan('pro', 49, { isTrial: true });
    confirmPendingPlan();
    const events = takeQueuedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: 'StartTrial', params: { value: 49, currency: 'EUR', content_name: 'pro' } });
  });

  test('keeps a queued StartTrial across a reload of the queue', () => {
    queueOwnerEvent('StartTrial', { value: 49, currency: 'EUR' });
    expect(readQueue()).toMatchObject([{ name: 'StartTrial' }]);
  });

  test('reports nothing when no plan was remembered', () => {
    confirmPendingPlan();
    expect(takeQueuedEvents()).toEqual([]);
  });
});
