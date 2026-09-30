import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as shopPage } from '../../../api/shop-page';
import { GET as llms } from '../../../api/llms';
import { isShopHost } from '../../../api/_lib/shopData';

const APP_HTML = '<html><head><title>Zenno</title><meta name="description" content="x" /></head><body></body></html>';
const MANIFEST = {
  business: { name: 'Salon Mira', permalink: 'mira', vertical: 'salon', location: { city: 'Hamburg' }, agent_enabled: true },
  services: [],
  specialists: [],
};

type Route = (url: string) => Response | Promise<Response>;

function mockFetch(route: Route) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(route(String(input)))));
}

const request = (host: string, path = '/') =>
  new Request(`https://${host}${path}`, { headers: { host, 'x-forwarded-proto': 'https' } });

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const shopRoutes: Route = (url) => {
  if (url.endsWith('/index.html')) return new Response(APP_HTML);
  if (url.includes('/rpc/resolve_tenant')) return Response.json([{ permalink: 'mira' }]);
  if (url.includes('agent-manifest')) return Response.json(MANIFEST);
  return new Response('unexpected', { status: 500 });
};

describe('isShopHost', () => {
  test('treats platform and preview hosts as non-shops', () => {
    expect(isShopHost('book.zennohq.com')).toBe(false);
    expect(isShopHost('app.onbuuk.com')).toBe(false);
    expect(isShopHost('onbuuk2025-abc.vercel.app')).toBe(false);
    expect(isShopHost('localhost:3000')).toBe(false);
    expect(isShopHost('mira.zennohq.com')).toBe(true);
    expect(isShopHost('salon-mira.de')).toBe(true);
  });
});

describe('GET / (shop-page)', () => {
  test('injects the business JSON-LD into the app HTML on a shop host', async () => {
    mockFetch(shopRoutes);
    const res = await shopPage(request('mira.zennohq.com'));
    const html = await res.text();
    expect(html).toContain('<title>Salon Mira · Hamburg · Book online</title>');
    expect(html).toContain('"@type":"ReserveAction"');
    expect(res.headers.get('Cache-Control')).toContain('s-maxage');
  });

  test('serves the plain app HTML on the platform host without calling Supabase', async () => {
    mockFetch(shopRoutes);
    const res = await shopPage(request('book.zennohq.com'));
    expect(await res.text()).toBe(APP_HTML);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('falls back to the plain app HTML when Supabase fails', async () => {
    mockFetch((url) => (url.endsWith('/index.html') ? new Response(APP_HTML) : new Response('down', { status: 503 })));
    const res = await shopPage(request('mira.zennohq.com'));
    expect(await res.text()).toBe(APP_HTML);
    expect(res.status).toBe(200);
  });

  test('serves the plain app HTML for an unknown shop host', async () => {
    mockFetch((url) => (url.includes('resolve_tenant') ? Response.json([]) : new Response(APP_HTML)));
    expect(await (await shopPage(request('unknown.zennohq.com'))).text()).toBe(APP_HTML);
  });
});

describe('GET /llms.txt', () => {
  test('returns the business summary on a shop host', async () => {
    mockFetch(shopRoutes);
    const res = await llms(request('mira.zennohq.com', '/llms.txt'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('# Salon Mira');
  });

  test('returns 404 on a platform host and 503 when data is unavailable', async () => {
    mockFetch(shopRoutes);
    expect((await llms(request('book.zennohq.com', '/llms.txt'))).status).toBe(404);
    mockFetch(() => new Response('down', { status: 503 }));
    expect((await llms(request('mira.zennohq.com', '/llms.txt'))).status).toBe(503);
  });

  test('returns 503 when Supabase is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_URL', '');
    mockFetch(shopRoutes);
    expect((await llms(request('mira.zennohq.com', '/llms.txt'))).status).toBe(503);
  });
});
