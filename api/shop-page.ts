// GET / on every host. For a shop host, serves the normal app HTML with the
// business's title, description and schema.org JSON-LD (incl. ReserveAction)
// injected, so AI search sees a bookable business. Any failure falls back to
// the unmodified app HTML — the page itself must never break.

import { buildHeadTags, injectHeadTags } from './_lib/agentSeo.js';
import { requestContext, shopManifest, SHOP_CACHE_HEADER } from './_lib/shopData.js';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

export async function GET(request: Request): Promise<Response> {
  const { host, origin } = requestContext(request);
  const appHtmlRes = await fetch(`${origin}/index.html`);
  const appHtml = await appHtmlRes.text();

  try {
    const manifest = await shopManifest(host);
    if (!manifest) return new Response(appHtml, { headers: HTML_HEADERS });
    const html = injectHeadTags(appHtml, buildHeadTags(manifest, origin));
    return new Response(html, { headers: { ...HTML_HEADERS, 'Cache-Control': SHOP_CACHE_HEADER } });
  } catch (err) {
    console.error(`shop-page: SEO injection failed for ${host}`, err);
    return new Response(appHtml, { headers: HTML_HEADERS });
  }
}
