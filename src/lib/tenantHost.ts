/**
 * Host-based tenancy: the hostname alone decides what this page is.
 *
 *   book.zennohq.studio        -> 'app'        admin, login, sign-up (no tenant)
 *   salon-a.zennohq.studio     -> 'shop'       tenant resolved by the server
 *   salon-a.de                 -> 'shop'       verified custom domain
 *   onbuuk.com / app.onbuuk.com -> 'legacy-app' old path links (/salon-a) are redirected
 *
 * Local development mirrors this: localhost:3000 is the app,
 * salon-a.localhost:3000 is a shop.
 */

import { BRAND_APP_URL } from './brand';

const stripDot = (value: string) => value.trim().toLowerCase().replace(/^\.+|\.+$/g, '');

export const APP_HOST = stripDot(import.meta.env.VITE_APP_HOST || 'book.zennohq.studio');
export const SHOP_BASE_DOMAIN = stripDot(import.meta.env.VITE_SHOP_BASE_DOMAIN || 'zennohq.studio');

/**
 * Turn on once *.zennohq.studio and book.zennohq.studio point at this deployment.
 * Before that, shop links stay on the current app host (app.onbuuk.com/<permalink>)
 * so nothing links to an address that does not resolve yet.
 * After: shop links use subdomains and old /<permalink> links redirect there.
 */
export const ARE_SHOP_SUBDOMAINS_LIVE = import.meta.env.VITE_SHOP_SUBDOMAINS_LIVE === 'true';

const LEGACY_APP_HOSTS = new Set(['onbuuk.com', 'www.onbuuk.com', 'app.onbuuk.com']);
const DEV_APP_HOST = 'localhost';
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export type HostKind = 'app' | 'legacy-app' | 'shop';

/** Paths that only exist on the app host. On a shop host they redirect there. */
export const APP_ONLY_PATHS = [
  '/admin', '/staff', '/superadmin', '/login', '/signup', '/register',
  '/signup-success', '/accept-invite', '/forgot-password',
];

export const isDevHost = (hostname: string): boolean => {
  const host = stripDot(hostname);
  return host === DEV_APP_HOST || host.endsWith(`.${DEV_APP_HOST}`) || IPV4.test(host);
};

export function classifyHost(hostname: string): HostKind {
  const host = stripDot(hostname);
  if (host === APP_HOST || host === DEV_APP_HOST || IPV4.test(host)) return 'app';
  if (LEGACY_APP_HOSTS.has(host)) return 'legacy-app';
  // Preview deployments (e.g. *.vercel.app) behave like the app host.
  if (host.endsWith('.vercel.app')) return 'app';
  return 'shop';
}

const devOrigin = (host: string) => {
  const { protocol, port } = window.location;
  return `${protocol}//${host}${port ? `:${port}` : ''}`;
};

/** Absolute URL on the platform app host, e.g. for /admin. */
export function appUrl(path = '/'): string {
  const liveOrigin = ARE_SHOP_SUBDOMAINS_LIVE ? `https://${APP_HOST}` : BRAND_APP_URL;
  const origin = isDevHost(window.location.hostname) ? devOrigin(DEV_APP_HOST) : liveOrigin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL of a shop by permalink (platform subdomain). */
export function shopUrl(permalink: string, path = '/'): string {
  if (!isDevHost(window.location.hostname) && !ARE_SHOP_SUBDOMAINS_LIVE) {
    return `${BRAND_APP_URL}/${permalink}${path === '/' ? '' : path}`;
  }
  const host = isDevHost(window.location.hostname)
    ? `${permalink}.${DEV_APP_HOST}`
    : `${permalink}.${SHOP_BASE_DOMAIN}`;
  const origin = isDevHost(window.location.hostname) ? devOrigin(host) : `https://${host}`;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL on a specific host (used to move a shop onto its primary address). */
export function hostUrl(host: string, path = '/'): string {
  const origin = isDevHost(host) ? devOrigin(host) : `https://${host}`;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export const isAppOnlyPath = (pathname: string): boolean =>
  APP_ONLY_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/** Must match the businesses_permalink_dns_label constraint in the database. */
export const RESERVED_SUBDOMAINS = [
  'www', 'app', 'api', 'book', 'booking', 'admin', 'superadmin', 'staff',
  'login', 'signup', 'register', 'account', 'accounts', 'auth', 'dashboard',
  'mail', 'email', 'smtp', 'imap', 'ftp', 'cdn', 'static', 'assets', 'media',
  'status', 'docs', 'help', 'support', 'blog', 'pay', 'payments', 'billing',
  'shop', 'store', 'studio', 'zenno', 'onbuuk', 'buuk', 'test', 'demo',
];

const MAX_DNS_LABEL_LENGTH = 63;

/** Turn free text into a valid subdomain label (a-z, 0-9, inner hyphens, max 63). */
export const toSubdomainLabel = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, MAX_DNS_LABEL_LENGTH)
    .replace(/^-|-$/g, '');
