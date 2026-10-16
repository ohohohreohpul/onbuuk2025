// /api/receptionist/whatsapp — WhatsApp webhooks (Meta Cloud API + QR gateway), proxied to Supabase.
import { proxyToReceptionist } from './_lib/receptionistProxy.js';

export const GET = (request: Request) => proxyToReceptionist(request, 'receptionist-whatsapp');
export const POST = (request: Request) => proxyToReceptionist(request, 'receptionist-whatsapp');
