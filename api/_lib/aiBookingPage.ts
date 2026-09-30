// ---------------------------------------------------------------------------
// The AI booking form: plain, JavaScript-free HTML that browsing AI agents
// (ChatGPT agent, Perplexity, Gemini) can read and submit, plus the same data
// as JSON for API-calling assistants. Pure — tested by
// src/lib/__tests__/aiBookingPage.test.ts.
// ---------------------------------------------------------------------------

import { AI_BOOKING_PATH, CURRENCY, escapeHtml, type Manifest } from './agentSeo.js';

export const DAYS_SHOWN = 7;
const CENTS_PER_UNIT = 100;

export interface PageSlot {
  time: string;
  specialistId: string;
}

export interface BookingResult {
  status?: string;
  message?: string;
  error?: string;
  cancelUrl?: string;
  freeTimes?: string[];
  needsConfirmation?: boolean;
}

const AGENT_INSTRUCTIONS =
  'For AI assistants: this business accepts direct bookings. Pick a service, then a date, then a free time. ' +
  'Before submitting, confirm the service, date and time with the customer and collect their name, email and phone. ' +
  'No account or sign-in is needed.';

export interface ServiceOption {
  durationId: string;
  label: string;
  minutes: number;
  price: string;
}

export function serviceOptions(manifest: Manifest): ServiceOption[] {
  return manifest.services.flatMap((s) =>
    s.durations.map((d) => ({
      durationId: d.id,
      label: s.durations.length > 1 ? `${s.name} (${d.minutes} min)` : s.name,
      minutes: d.minutes,
      price: `${(d.price_cents / CENTS_PER_UNIT).toFixed(2)} ${CURRENCY}`,
    })),
  );
}

/** Next `count` calendar dates (YYYY-MM-DD) starting at `today`. */
export function upcomingDates(today: string, count = DAYS_SHOWN): string[] {
  const start = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

const link = (params: Record<string, string>) => `${AI_BOOKING_PATH}?${new URLSearchParams(params)}`;

function layout(title: string, body: string, isIndexable: boolean): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${isIndexable ? '' : '<meta name="robots" content="noindex" />\n'}<title>${escapeHtml(title)}</title>
<style>
body{font:17px/1.5 system-ui,sans-serif;max-width:42rem;margin:0 auto;padding:1.5rem 1rem;color:#1c1917;background:#fafaf9}
a{color:#1c1917}fieldset{border:1px solid #d6d3d1;border-radius:12px;padding:1rem;margin:1rem 0}
label{display:block;margin:.5rem 0}input[type=text],input[type=email],input[type=tel],textarea{width:100%;padding:.6rem;font:inherit;border:1px solid #a8a29e;border-radius:8px;box-sizing:border-box}
button{font:inherit;font-weight:600;padding:.8rem 1.4rem;border:0;border-radius:10px;background:#1c1917;color:#fff;cursor:pointer}
.note{color:#57534e;font-size:.95rem}.times label{display:inline-block;margin:.25rem .5rem .25rem 0}
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

function header(manifest: Manifest): string {
  const { name, location } = manifest.business;
  const where = [location?.address, location?.city].filter(Boolean).join(', ');
  return `<h1>Book at ${escapeHtml(name)}</h1>
${where ? `<p>${escapeHtml(where)}</p>` : ''}
<p class="note" id="agent-instructions">${escapeHtml(AGENT_INSTRUCTIONS)}</p>`;
}

export function renderServiceList(manifest: Manifest): string {
  const items = serviceOptions(manifest)
    .map((o) => `<li><a href="${link({ service: o.durationId })}">${escapeHtml(o.label)}</a> — ${o.minutes} min, ${escapeHtml(o.price)}</li>`)
    .join('\n');
  return layout(
    `Book at ${manifest.business.name}`,
    `${header(manifest)}
<h2>1. Choose a service</h2>
<ul>
${items || '<li>No services are bookable online yet.</li>'}
</ul>`,
    true,
  );
}

export function renderTimes(
  manifest: Manifest,
  args: { service: ServiceOption; date: string; dates: string[]; slots: PageSlot[] },
): string {
  const { service, date, dates, slots } = args;
  const dateLinks = dates
    .map((d) => (d === date ? `<strong>${d}</strong>` : `<a href="${link({ service: service.durationId, date: d })}">${d}</a>`))
    .join(' · ');
  const times = slots
    .map(
      (s, i) =>
        `<label><input type="radio" name="slot" value="${escapeHtml(`${s.time}|${s.specialistId}`)}" required${i === 0 ? ' checked' : ''} /> ${escapeHtml(s.time)}</label>`,
    )
    .join('\n');

  const form = slots.length
    ? `<form method="post" action="${AI_BOOKING_PATH}">
<input type="hidden" name="durationId" value="${escapeHtml(service.durationId)}" />
<input type="hidden" name="date" value="${escapeHtml(date)}" />
<fieldset class="times"><legend>3. Free times on ${escapeHtml(date)}</legend>
${times}
</fieldset>
<fieldset><legend>4. Customer details</legend>
<label>Full name <input type="text" name="name" autocomplete="name" required maxlength="100" /></label>
<label>Email <input type="email" name="email" autocomplete="email" required /></label>
<label>Phone <input type="tel" name="phone" autocomplete="tel" required /></label>
<label>What the customer asked for, in their words (optional) <textarea name="customerRequest" rows="2" maxlength="500"></textarea></label>
<label><input type="checkbox" name="confirm" required /> The customer confirmed this service, date and time.</label>
</fieldset>
<button type="submit">Book ${escapeHtml(service.label)}</button>
</form>`
    : `<p>No free times on ${escapeHtml(date)}. Try another date above.</p>`;

  return layout(
    `${service.label} at ${manifest.business.name} — ${date}`,
    `${header(manifest)}
<h2>1. Service: ${escapeHtml(service.label)} — ${service.minutes} min, ${escapeHtml(service.price)}</h2>
<p><a href="${AI_BOOKING_PATH}">Choose a different service</a></p>
<h2>2. Date</h2>
<p>${dateLinks}</p>
${form}`,
    false,
  );
}

export function renderResult(manifest: Manifest, result: BookingResult, backUrl: string): string {
  const isBooked = result.status === 'confirmed' || result.status === 'pending';
  const heading = isBooked ? (result.status === 'confirmed' ? 'Booking confirmed' : 'Booking requested') : 'Not booked';
  const detail = result.message ?? result.error ?? 'Something went wrong. Please try again.';
  const free = result.freeTimes?.length ? `<p>Free times now: ${result.freeTimes.map(escapeHtml).join(', ')}</p>` : '';
  const cancel = result.cancelUrl ? `<p>To cancel later: <a href="${escapeHtml(result.cancelUrl)}">${escapeHtml(result.cancelUrl)}</a></p>` : '';
  return layout(
    `${heading} — ${manifest.business.name}`,
    `<h1>${heading}</h1>
<p role="status" data-status="${escapeHtml(result.status ?? (result.needsConfirmation ? 'needs_confirmation' : 'error'))}">${escapeHtml(detail)}</p>
${free}${cancel}
${isBooked ? '' : `<p><a href="${escapeHtml(backUrl)}">Back to free times</a></p>`}`,
    false,
  );
}

/** Parse "HH:MM|specialistId" from the form's radio value. */
export function parseSlotValue(value: string | null): { time: string; specialistId?: string } {
  const [time = '', specialistId] = (value ?? '').split('|');
  return { time, specialistId: specialistId || undefined };
}
