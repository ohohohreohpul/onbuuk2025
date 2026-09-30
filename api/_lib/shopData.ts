// Server-side data access for shop hosts (Vercel functions). Uses only the
// public Supabase anon key and public endpoints — the same data the shop page
// already shows in the browser.

import type { Manifest } from './agentSeo.js';

const PLATFORM_HOSTS = new Set([
  'zennohq.studio', 'www.zennohq.studio', 'book.zennohq.studio',
  'zennohq.com', 'www.zennohq.com', 'book.zennohq.com',
  'onbuuk.com', 'www.onbuuk.com', 'app.onbuuk.com',
  'localhost',
]);

export interface ShopRequestContext {
  host: string;
  origin: string;
}

interface ResolvedTenantRow {
  permalink: string;
}

function supabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  if (!url || !anonKey) throw new Error('Supabase URL/anon key are not configured for Vercel functions');
  return { url, anonKey };
}

export function requestContext(request: Request): ShopRequestContext {
  const url = new URL(request.url);
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host).toLowerCase();
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return { host, origin: `${proto}://${host}` };
}

/** Platform hosts (app, marketing, previews) are not shops. */
export function isShopHost(host: string): boolean {
  const hostname = host.split(':')[0];
  return !PLATFORM_HOSTS.has(hostname) && !hostname.endsWith('.vercel.app');
}

export async function resolvePermalink(host: string): Promise<string | null> {
  const { url, anonKey } = supabaseConfig();
  const res = await fetch(`${url}/rest/v1/rpc/resolve_tenant`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_host: host }),
  });
  if (!res.ok) throw new Error(`resolve_tenant failed: ${res.status}`);
  const rows = (await res.json()) as ResolvedTenantRow[];
  return rows[0]?.permalink ?? null;
}

export async function fetchManifest(permalink: string): Promise<Manifest | null> {
  const { url, anonKey } = supabaseConfig();
  const res = await fetch(`${url}/functions/v1/agent-manifest?permalink=${encodeURIComponent(permalink)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`agent-manifest failed: ${res.status}`);
  return (await res.json()) as Manifest;
}

/** Manifest for the shop behind this host, or null for platform/unknown hosts. */
export async function shopManifest(host: string): Promise<Manifest | null> {
  if (!isShopHost(host)) return null;
  const permalink = await resolvePermalink(host);
  return permalink ? fetchManifest(permalink) : null;
}

/** Edge-cache shop responses briefly; business data changes rarely. */
export const SHOP_CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';
