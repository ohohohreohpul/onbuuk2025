// /ai-booking on every shop host — the booking form made for AI.
//   GET                       → services
//   GET ?service=<durationId>&date=YYYY-MM-DD → free times + booking form
//   POST (form or JSON)       → books via the keyless agent-direct function
// Add ?format=json (or Accept: application/json) for machine-readable output.

import { AI_BOOKING_PATH } from './_lib/agentSeo.js';
import {
  parseSlotValue,
  renderResult,
  renderServiceList,
  renderTimes,
  serviceOptions,
  upcomingDates,
  type BookingResult,
  type PageSlot,
} from './_lib/aiBookingPage.js';
import { berlinToday, callDirect, clientAddress, agentLabel } from './_lib/directClient.js';
import { requestContext, shopManifest } from './_lib/shopData.js';
import type { Manifest } from './_lib/agentSeo.js';

const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

const wantsJson = (request: Request, url: URL) =>
  url.searchParams.get('format') === 'json' || (request.headers.get('accept') ?? '').startsWith('application/json');

const notFound = (asJson: boolean) =>
  asJson
    ? Response.json({ error: 'No bookable business at this address' }, { status: 404, headers: JSON_HEADERS })
    : new Response('No bookable business at this address.', { status: 404, headers: { 'Content-Type': 'text/plain' } });

async function loadManifest(request: Request): Promise<Manifest | null> {
  return shopManifest(requestContext(request).host);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const asJson = wantsJson(request, url);
  try {
    const manifest = await loadManifest(request);
    if (!manifest?.business.agent_enabled) return notFound(asJson);

    const options = serviceOptions(manifest);
    const service = options.find((o) => o.durationId === url.searchParams.get('service'));
    if (!service) {
      return asJson
        ? Response.json({ business: manifest.business.name, services: options, next: `${AI_BOOKING_PATH}?service=<durationId>&date=YYYY-MM-DD&format=json` }, { headers: JSON_HEADERS })
        : new Response(renderServiceList(manifest), { headers: HTML });
    }

    const dates = upcomingDates(berlinToday());
    const requested = url.searchParams.get('date') ?? '';
    const date = dates.includes(requested) ? requested : dates[0];
    const res = await callDirect({ action: 'availability', permalink: manifest.business.permalink, durationId: service.durationId, date });
    const slots = ((res.body.slots as PageSlot[] | undefined) ?? []);

    if (asJson) {
      return Response.json(
        { business: manifest.business.name, service, date, otherDates: dates, slots, book: { method: 'POST', url: AI_BOOKING_PATH, fields: ['durationId', 'date', 'time', 'specialistId', 'name', 'email', 'phone', 'confirm', 'customerRequest'] } },
        { headers: JSON_HEADERS },
      );
    }
    return new Response(renderTimes(manifest, { service, date, dates, slots }), { headers: HTML });
  } catch (err) {
    console.error('ai-booking GET failed', err);
    return asJson
      ? Response.json({ error: 'Temporarily unavailable' }, { status: 503, headers: JSON_HEADERS })
      : new Response('Temporarily unavailable. Please try again.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return ((await request.json().catch(() => ({}))) as Record<string, unknown>) ?? {};
  const form = await request.formData();
  const fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const { time, specialistId } = parseSlotValue(fields.slot ?? null);
  return { ...fields, time: fields.time ?? time, specialistId: fields.specialistId ?? specialistId };
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const isJsonRequest = (request.headers.get('content-type') ?? '').includes('application/json');
  const asJson = isJsonRequest || wantsJson(request, url);
  try {
    const manifest = await loadManifest(request);
    if (!manifest?.business.agent_enabled) return notFound(asJson);

    const body = await readBody(request);
    const { origin } = requestContext(request);
    const res = await callDirect({
      ...body,
      action: 'book',
      permalink: manifest.business.permalink,
      client: clientAddress(request),
      agentName: agentLabel(request),
      origin,
    });

    if (asJson) return Response.json(res.body, { status: res.status, headers: JSON_HEADERS });
    const backUrl = `${AI_BOOKING_PATH}?${new URLSearchParams({ service: String(body.durationId ?? ''), date: String(body.date ?? '') })}`;
    return new Response(renderResult(manifest, res.body as BookingResult, backUrl), { status: res.status, headers: HTML });
  } catch (err) {
    console.error('ai-booking POST failed', err);
    return asJson
      ? Response.json({ error: 'Temporarily unavailable' }, { status: 503, headers: JSON_HEADERS })
      : new Response('Temporarily unavailable. Please try again.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
