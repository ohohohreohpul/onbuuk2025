// /api/receptionist/chat on every Zenno host — website chat widget API (proxied to Supabase).
import { proxyToReceptionist } from './_lib/receptionistProxy.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
export const GET = (request: Request) => proxyToReceptionist(request, 'receptionist-chat');
export const POST = (request: Request) => proxyToReceptionist(request, 'receptionist-chat');
