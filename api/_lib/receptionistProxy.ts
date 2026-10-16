// Forwards the public AI-receptionist endpoints from our own domain to the
// Supabase edge functions, so shops, customers and Meta never see the
// Supabase address. The real visitor IP is passed on with a shared secret
// (RECEPTIONIST_PROXY_SECRET), so per-IP rate limits keep working.

import { clientAddress } from './directClient.js';

const FORWARDED_HEADERS = ['content-type', 'x-hub-signature-256', 'x-zenno-webhook-token'];
const TIMEOUT_MS = 55_000;

export async function proxyToReceptionist(request: Request, functionName: 'receptionist-chat' | 'receptionist-whatsapp'): Promise<Response> {
  const base = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
  if (!base) return Response.json({ error: 'Temporarily unavailable' }, { status: 503 });

  const url = new URL(request.url);
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (anonKey) headers.set('apikey', anonKey);
  const secret = process.env.RECEPTIONIST_PROXY_SECRET ?? '';
  if (secret) {
    headers.set('x-zenno-proxy-secret', secret);
    headers.set('x-zenno-client-ip', clientAddress(request));
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  try {
    const upstream = await fetch(`${base}/functions/v1/${functionName}${url.search}`, {
      method: request.method,
      headers,
      // Raw bytes: Meta's signature is computed over the exact body.
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const responseHeaders = new Headers({
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    });
    if (functionName === 'receptionist-chat') {
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error(`${functionName} proxy failed`, error);
    return Response.json({ error: 'Temporarily unavailable' }, { status: 503 });
  }
}
