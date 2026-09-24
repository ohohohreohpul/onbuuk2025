const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const BRAND_NAME = 'Zenno';
export const BRAND_PRODUCT_NAME = 'Zenno Booking';
export const BRAND_TAGLINE = 'Bookings, customers, and revenue in one place.';

export const BRAND_SITE_URL = stripTrailingSlash(
  import.meta.env.VITE_PUBLIC_SITE_URL || 'https://zennohq.studio'
);
// The live app address. Stays on app.onbuuk.com until book.zennohq.studio is
// pointed at the deployment; then set VITE_PUBLIC_APP_URL=https://book.zennohq.studio.
export const BRAND_APP_URL = stripTrailingSlash(
  import.meta.env.VITE_PUBLIC_APP_URL || 'https://app.onbuuk.com'
);
export const BRAND_SUPPORT_URL = stripTrailingSlash(
  import.meta.env.VITE_PUBLIC_SUPPORT_URL || `${BRAND_SITE_URL}/support`
);
export const BRAND_DOCS_URL = stripTrailingSlash(
  import.meta.env.VITE_PUBLIC_DOCS_URL || `${BRAND_SITE_URL}/docs`
);

export const BRAND_LOGO = '/zenno-logo.svg';
export const BRAND_LOGO_LIGHT = '/zenno-logo-light.svg';
export const BRAND_MARK = '/zenno-mark.svg';
export const BRAND_FAVICON = '/zenno-mark.svg';
export const BRAND_OG_IMAGE = `${BRAND_APP_URL}/zenno-og.png`;

const PLATFORM_DOMAINS = new Set([
  'zennohq.studio',
  'book.zennohq.studio',
  // Keep the former Buuk domains recognised during the transition so
  // existing merchant links continue resolving instead of being treated as
  // customer-owned custom domains.
  'onbuuk.com',
  'app.onbuuk.com',
]);

export function isPlatformDomain(hostname: string): boolean {
  return PLATFORM_DOMAINS.has(hostname.toLowerCase());
}
