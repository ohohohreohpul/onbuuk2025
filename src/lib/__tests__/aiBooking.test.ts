import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../../../api/ai-booking';
import {
  serviceOptions,
  upcomingDates,
  renderServiceList,
  renderTimes,
  renderResult,
  parseSlotValue,
} from '../../../api/_lib/aiBookingPage';
import { agentLabel, clientAddress, berlinToday } from '../../../api/_lib/directClient';
import type { Manifest } from '../../../api/_lib/agentSeo';

const DURATION = '00000000-0000-4000-a000-00000000e2e2';
const HOST = 'mira.zennohq.com';

const manifest = (agentEnabled = true): Manifest => ({
  business: { name: 'Salon <Mira>', permalink: 'mira', location: { city: 'Hamburg' }, agent_enabled: agentEnabled },
  services: [
    { id: 's1', name: 'Haarschnitt', durations: [{ id: DURATION, minutes: 45, price_cents: 4500 }] },
    { id: 's2', name: 'Farbe', durations: [{ id: 'd2', minutes: 60, price_cents: 6000 }, { id: 'd3', minutes: 90, price_cents: 8000 }] },
  ],
  specialists: [],
});

describe('page rendering', () => {
  test('serviceOptions labels multi-duration services with their length', () => {
    expect(serviceOptions(manifest()).map((o) => o.label)).toEqual(['Haarschnitt', 'Farbe (60 min)', 'Farbe (90 min)']);
  });

  test('upcomingDates returns consecutive days', () => {
    expect(upcomingDates('2026-12-30', 3)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });

  test('service list escapes the business name and tells agents how to book', () => {
    const html = renderServiceList(manifest());
    expect(html).toContain('Book at Salon &lt;Mira&gt;');
    expect(html).toContain(`/ai-booking?service=${DURATION}`);
    expect(html).toContain('confirm the service, date and time with the customer');
    expect(html).not.toContain('<script');
  });

  test('service list says so when nothing is bookable', () => {
    expect(renderServiceList({ ...manifest(), services: [] })).toContain('No services are bookable online yet.');
  });

  test('times page renders a no-JS form with a required confirmation checkbox', () => {
    const [service] = serviceOptions(manifest());
    const html = renderTimes(manifest(), {
      service,
      date: '2026-10-02',
      dates: ['2026-10-02', '2026-10-03'],
      slots: [{ time: '14:30', specialistId: 'p1' }],
    });
    expect(html).toContain('<form method="post" action="/ai-booking">');
    expect(html).toContain('value="14:30|p1"');
    expect(html).toContain('name="confirm" required');
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  test('times page explains when a day is full', () => {
    const [service] = serviceOptions(manifest());
    const html = renderTimes(manifest(), { service, date: '2026-10-02', dates: ['2026-10-02'], slots: [] });
    expect(html).toContain('No free times on 2026-10-02');
  });

  test('result page reports confirmed, pending and failed bookings', () => {
    expect(renderResult(manifest(), { status: 'confirmed', message: 'Booked.', cancelUrl: 'https://x/cancel?id=1' }, '/ai-booking')).toContain('Booking confirmed');
    expect(renderResult(manifest(), { status: 'pending', message: 'Requested.' }, '/ai-booking')).toContain('Booking requested');
    const failed = renderResult(manifest(), { error: 'That time is no longer free.', freeTimes: ['15:00'] }, '/ai-booking?x=1');
    expect(failed).toContain('Not booked');
    expect(failed).toContain('Free times now: 15:00');
    expect(failed).toContain('Back to free times');
    expect(renderResult(manifest(), { needsConfirmation: true }, '/b')).toContain('data-status="needs_confirmation"');
  });

  test('parseSlotValue splits time and staff', () => {
    expect(parseSlotValue('14:30|p1')).toEqual({ time: '14:30', specialistId: 'p1' });
    expect(parseSlotValue(null)).toEqual({ time: '', specialistId: undefined });
  });
});

describe('request facts', () => {
  test('agentLabel recognises known assistants and defaults otherwise', () => {
    const req = (ua: string) => new Request('https://x', { headers: { 'user-agent': ua } });
    expect(agentLabel(req('Mozilla/5.0 ChatGPT-User/1.0'))).toBe('ChatGPT');
    expect(agentLabel(req('PerplexityBot/1.0'))).toBe('Perplexity');
    expect(agentLabel(req('curl/8'))).toBe('AI assistant');
  });

  test('clientAddress takes the first forwarded hop', () => {
    expect(clientAddress(new Request('https://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } }))).toBe('1.2.3.4');
    expect(clientAddress(new Request('https://x'))).toBe('unknown');
  });

  test('berlinToday uses the business time zone', () => {
    expect(berlinToday(new Date('2026-10-01T23:30:00Z'))).toBe('2026-10-02');
  });
});

// --- handler ---------------------------------------------------------------

let directCalls: Record<string, unknown>[] = [];
let directResponse: { status: number; body: unknown } = { status: 200, body: {} };

function stubBackend(isAgentEnabled = true) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('resolve_tenant')) return Response.json([{ permalink: 'mira' }]);
    if (url.includes('agent-manifest')) return Response.json(manifest(isAgentEnabled));
    if (url.includes('agent-direct')) {
      directCalls.push(JSON.parse(String(init?.body)));
      return Response.json(directResponse.body, { status: directResponse.status });
    }
    return new Response('unexpected', { status: 500 });
  }));
}

const get = (query = '', headers: Record<string, string> = {}) =>
  GET(new Request(`https://${HOST}/ai-booking${query}`, { headers: { host: HOST, ...headers } }));

beforeEach(() => {
  directCalls = [];
  directResponse = { status: 200, body: { slots: [{ time: '14:30', specialistId: 'p1' }] } };
  vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /ai-booking', () => {
  test('lists services as HTML and JSON', async () => {
    stubBackend();
    expect(await (await get()).text()).toContain('1. Choose a service');
    const json = await (await get('?format=json')).json();
    expect(json.services).toHaveLength(3);
  });

  test('shows free times for a service and asks agent-direct for the right slot', async () => {
    stubBackend();
    const res = await get(`?service=${DURATION}&date=not-a-date`, { accept: 'application/json' });
    const json = await res.json();
    expect(json.slots).toEqual([{ time: '14:30', specialistId: 'p1' }]);
    expect(directCalls[0]).toMatchObject({ action: 'availability', permalink: 'mira', durationId: DURATION, date: berlinToday() });
    expect(await (await get(`?service=${DURATION}`)).text()).toContain('value="14:30|p1"');
  });

  test('returns 404 when the business has AI booking off', async () => {
    stubBackend(false);
    expect((await get()).status).toBe(404);
    expect((await get('?format=json')).status).toBe(404);
  });

  test('returns 503 when the backend is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    expect((await get()).status).toBe(503);
    expect((await get('?format=json')).status).toBe(503);
  });
});

describe('POST /ai-booking', () => {
  const formBody = () =>
    new URLSearchParams({
      durationId: DURATION, date: '2026-10-02', slot: '14:30|p1', name: 'Jane', email: 'j@x.de', phone: '+49401234', confirm: 'on',
      permalink: 'someone-else', client: 'spoofed',
    });

  test('books from the HTML form and ignores spoofed routing fields', async () => {
    stubBackend();
    directResponse = { status: 200, body: { status: 'confirmed', message: 'Booked.' } };
    const res = await POST(new Request(`https://${HOST}/ai-booking`, {
      method: 'POST',
      headers: { host: HOST, 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '5.6.7.8', 'user-agent': 'ChatGPT-User' },
      body: formBody(),
    }));
    expect(await res.text()).toContain('Booking confirmed');
    expect(directCalls[0]).toMatchObject({
      action: 'book', permalink: 'mira', client: '5.6.7.8', agentName: 'ChatGPT', time: '14:30', specialistId: 'p1', origin: `https://${HOST}`,
    });
  });

  test('books from JSON and passes the backend status through', async () => {
    stubBackend();
    directResponse = { status: 409, body: { error: 'That time is no longer free.' } };
    const res = await POST(new Request(`https://${HOST}/ai-booking`, {
      method: 'POST',
      headers: { host: HOST, 'content-type': 'application/json' },
      body: JSON.stringify({ durationId: DURATION, date: '2026-10-02', time: '14:30', name: 'J', email: 'j@x.de', phone: '+4940123', confirm: true }),
    }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no longer free/);
  });

  test('returns 404 when AI booking is off and 503 when the backend fails', async () => {
    stubBackend(false);
    const post = (type: string) =>
      POST(new Request(`https://${HOST}/ai-booking`, { method: 'POST', headers: { host: HOST, 'content-type': type }, body: '{}' }));
    expect((await post('application/json')).status).toBe(404);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    expect((await post('application/json')).status).toBe(503);
    expect((await post('text/plain')).status).toBe(503);
  });
});
