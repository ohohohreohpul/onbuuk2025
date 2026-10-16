// /api/m on every Zenno host — campaign email results.
//   ?o=<token>                 the open image (1×1 gif)
//   ?c=<token>&u=<url>&s=<sig> a click: counted, then forwarded to the link
// Signature format matches supabase/functions/_shared/marketingTracking.ts.
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATURE_LENGTH = 32;
const TIMEOUT_MS = 4_000;
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const FALLBACK = 'https://book.zennohq.com';

function signatureOk(token: string, url: string, given: string): boolean {
  const secret = process.env.MARKETING_LINK_SECRET ?? '';
  if (secret.length < 32 || given.length !== SIGNATURE_LENGTH) return false;
  const expected = createHmac('sha256', secret).update(`${token}|${url}`).digest('hex').slice(0, SIGNATURE_LENGTH);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

/** Counts the event; never blocks the reader for long, never throws. */
async function record(token: string, kind: 'open' | 'click'): Promise<void> {
  const base = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  if (!base || !anonKey) return;
  try {
    await fetch(`${base}/rest/v1/rpc/record_marketing_event`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_kind: kind }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.error('marketing event not recorded', error);
  }
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const open = params.get('o');
  if (open) {
    if (TOKEN.test(open)) await record(open, 'open');
    return new Response(GIF, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' } });
  }

  const token = params.get('c') ?? '';
  const target = params.get('u') ?? '';
  let url: URL | null = null;
  try {
    url = new URL(target);
  } catch {
    url = null;
  }
  if (!TOKEN.test(token) || !url || url.protocol !== 'https:' || !signatureOk(token, target, params.get('s') ?? '')) {
    return Response.redirect(FALLBACK, 302);
  }
  await record(token, 'click');
  return new Response(null, { status: 302, headers: { Location: url.toString(), 'Cache-Control': 'no-store' } });
}
