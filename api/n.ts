// /api/n on every Zenno host — newsletter pages for customers (no sign-in).
//   ?t=<token>            unsubscribe (GET page, POST one-click per RFC 8058)
//   ?a=confirm&t=<token>  double opt-in (GET page with a button, POST confirms)
// Forwards to the marketing-unsubscribe edge function, so customers never see the
// Supabase URL and the page is served as real HTML.
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMEOUT_MS = 8_000;

async function forward(request: Request): Promise<Response> {
  const incoming = new URL(request.url).searchParams;
  const token = incoming.get('t') ?? '';
  const base = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  if (!TOKEN.test(token) || !base) return new Response('Not found', { status: 404 });

  const target = new URL(`${base}/functions/v1/marketing-unsubscribe`);
  target.searchParams.set('t', token);
  if (incoming.get('a') === 'confirm') target.searchParams.set('a', 'confirm');

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: request.method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
      body: request.method === 'POST' ? await request.text() : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await upstream.text();
    const isPage = body.trimStart().startsWith('<!doctype html>');
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': isPage ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('newsletter page failed', error);
    return new Response('Please try again in a moment.', { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
