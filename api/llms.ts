// GET /llms.txt on a shop host: plain-text summary of the business for AI
// assistants — services, prices, hours, and how to book directly.

import { buildLlmsTxt } from './_lib/agentSeo.js';
import { requestContext, shopManifest, SHOP_CACHE_HEADER } from './_lib/shopData.js';

const TEXT_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8' };

export async function GET(request: Request): Promise<Response> {
  const { host, origin } = requestContext(request);
  try {
    const manifest = await shopManifest(host);
    if (!manifest) return new Response('Not found\n', { status: 404, headers: TEXT_HEADERS });
    return new Response(buildLlmsTxt(manifest, origin), {
      headers: { ...TEXT_HEADERS, 'Cache-Control': SHOP_CACHE_HEADER },
    });
  } catch (err) {
    console.error(`llms: failed for ${host}`, err);
    return new Response('Temporarily unavailable\n', { status: 503, headers: TEXT_HEADERS });
  }
}
