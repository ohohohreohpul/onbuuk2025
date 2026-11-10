import type { HostKind } from './tenantHost';

/**
 * Zenno's own Meta pixel, for owners only. It measures Zenno's ads (an owner
 * signing up or buying a plan) and must never run where a shop's customers
 * book or buy, so it is limited to the owner paths on the app host and only
 * starts after the owner accepts cookies.
 */

export type Consent = 'granted' | 'denied';
export type OwnerEventName = 'CompleteRegistration' | 'Purchase';

export interface OwnerEvent {
  name: OwnerEventName;
  /** Lets the Conversions API deduplicate this event against a server copy later. */
  eventId: string;
  params?: Record<string, string | number>;
}

const CONSENT_KEY = 'zenno-consent';
const QUEUE_KEY = 'zenno-owner-events';
const PENDING_PLAN_KEY = 'zenno-pending-plan';
export const CONSENT_CHANGE_EVENT = 'zenno:consent-change';

/** Owner-facing paths on the app host: landing, sign-up, login and the dashboard. */
const OWNER_PATHS = new Set(['/', '/login', '/signup', '/register', '/signup-success']);

export function isOwnerSurface(pathname: string, hostKind: HostKind): boolean {
  if (hostKind !== 'app') return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname;
  return OWNER_PATHS.has(path) || path === '/admin' || path.endsWith('/admin');
}

export function readConsent(storage: Storage = window.localStorage): Consent | null {
  try {
    const value = storage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function writeConsent(consent: Consent, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(CONSENT_KEY, consent);
  } catch {
    // Storage blocked: the choice lasts for this page only and the banner asks again next time.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}

export function readQueue(storage: Storage = window.sessionStorage): OwnerEvent[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(QUEUE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isOwnerEvent) : [];
  } catch {
    return [];
  }
}

function isOwnerEvent(value: unknown): value is OwnerEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<OwnerEvent>;
  return (event.name === 'CompleteRegistration' || event.name === 'Purchase') && typeof event.eventId === 'string';
}

function writeQueue(events: OwnerEvent[], storage: Storage = window.sessionStorage): void {
  try {
    if (events.length) storage.setItem(QUEUE_KEY, JSON.stringify(events));
    else storage.removeItem(QUEUE_KEY);
  } catch {
    // Storage blocked: the event is dropped rather than sent without consent.
  }
}

const newEventId = (name: OwnerEventName) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Remembers an event for this tab. Sign-up redirects straight to /admin, which
 * would cut off a request in flight, so events wait here until a page with
 * consent sends them (see `takeQueuedEvents`).
 */
export function queueOwnerEvent(name: OwnerEventName, params?: OwnerEvent['params'], storage?: Storage): void {
  writeQueue([...readQueue(storage), { name, eventId: newEventId(name), params }], storage);
  window.dispatchEvent(new Event(QUEUE_CHANGE_EVENT));
}
export const QUEUE_CHANGE_EVENT = 'zenno:owner-events';

/** Returns the waiting events and empties the queue, so each one is sent once. */
export function takeQueuedEvents(storage?: Storage): OwnerEvent[] {
  const events = readQueue(storage);
  writeQueue([], storage);
  return events;
}

/** Called just before Stripe checkout: which plan the owner is buying, and its price. */
export function rememberPendingPlan(plan: string, valueEuros: number, storage: Storage = window.sessionStorage): void {
  try {
    storage.setItem(PENDING_PLAN_KEY, JSON.stringify({ plan, value: valueEuros }));
  } catch {
    // Without storage the Purchase is not reported; checkout itself is unaffected.
  }
}

/** On ?upgrade=success: turns the remembered plan into one Purchase event. */
export function confirmPendingPlan(storage: Storage = window.sessionStorage): void {
  let pending: { plan?: unknown; value?: unknown } | null = null;
  try {
    pending = JSON.parse(storage.getItem(PENDING_PLAN_KEY) ?? 'null');
    storage.removeItem(PENDING_PLAN_KEY);
  } catch {
    pending = null;
  }
  if (!pending || typeof pending.plan !== 'string' || typeof pending.value !== 'number') return;
  queueOwnerEvent('Purchase', { value: pending.value, currency: 'EUR', content_name: pending.plan }, storage);
}
