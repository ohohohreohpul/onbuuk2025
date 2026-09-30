// ---------------------------------------------------------------------------
// "Get found" for AI search: turns a business manifest (agent-manifest edge
// function) into schema.org JSON-LD, llms.txt, and <head> tags injected into
// the shop page's initial HTML, so crawlers (Google, ChatGPT, Perplexity) learn
// the business can be booked directly. Pure — tested by
// src/lib/__tests__/agentSeo.test.ts.
// ---------------------------------------------------------------------------

/** Where the AI booking form lives on every shop host (parts 2–3). */
export const AI_BOOKING_PATH = '/ai-booking';
export const CURRENCY = 'EUR';
const CENTS_PER_UNIT = 100;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SCHEMA_TYPE_BY_VERTICAL: Record<string, string> = {
  salon: 'HairSalon',
  barber: 'HairSalon',
  beauty: 'BeautySalon',
  wellness: 'DaySpa',
  fitness: 'HealthClub',
  clinic: 'MedicalClinic',
};

export interface ManifestDuration {
  id: string;
  minutes: number;
  price_cents: number;
}

export interface ManifestService {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  durations: ManifestDuration[];
}

export interface ManifestWorkingHours {
  day: number;
  start: string;
  end: string;
  available: boolean;
}

export interface Manifest {
  business: {
    name: string;
    permalink: string;
    vertical?: string | null;
    location?: { city?: string | null; address?: string | null };
    description?: string | null;
    agent_enabled?: boolean;
  };
  services: ManifestService[];
  specialists: { id: string; name: string; active?: boolean; working_hours: ManifestWorkingHours[] }[];
}

export interface HeadTags {
  title: string;
  description: string;
  jsonLd: Record<string, unknown>;
}

export const schemaType = (vertical?: string | null): string =>
  (vertical && SCHEMA_TYPE_BY_VERTICAL[vertical]) || 'LocalBusiness';

const hhmm = (time: string): string => time.slice(0, 5);
const price = (cents: number): string => (cents / CENTS_PER_UNIT).toFixed(2);

/** Business opening hours per weekday = earliest start to latest end across active staff. */
export function openingHours(manifest: Manifest): { day: number; opens: string; closes: string }[] {
  const byDay = new Map<number, { opens: string; closes: string }>();
  for (const sp of manifest.specialists) {
    if (sp.active === false) continue;
    for (const wh of sp.working_hours) {
      if (!wh.available) continue;
      const opens = hhmm(wh.start);
      const closes = hhmm(wh.end);
      const current = byDay.get(wh.day);
      byDay.set(wh.day, {
        opens: current && current.opens < opens ? current.opens : opens,
        closes: current && current.closes > closes ? current.closes : closes,
      });
    }
  }
  return [...byDay.entries()].sort(([a], [b]) => a - b).map(([day, h]) => ({ day, ...h }));
}

function describe(manifest: Manifest): string {
  const { name, description, location } = manifest.business;
  if (description) return description;
  const place = location?.city ? ` in ${location.city}` : '';
  return `Book an appointment at ${name}${place}.`;
}

export function buildJsonLd(manifest: Manifest, origin: string): Record<string, unknown> {
  const { business } = manifest;
  const bookingUrl = `${origin}${AI_BOOKING_PATH}`;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType(business.vertical),
    '@id': `${origin}/#business`,
    name: business.name,
    url: `${origin}/`,
    description: describe(manifest),
    address: {
      '@type': 'PostalAddress',
      ...(business.location?.address ? { streetAddress: business.location.address } : {}),
      ...(business.location?.city ? { addressLocality: business.location.city } : {}),
    },
    openingHoursSpecification: openingHours(manifest).map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY_NAMES[h.day]}`,
      opens: h.opens,
      closes: h.closes,
    })),
    makesOffer: manifest.services.flatMap((s) =>
      s.durations.map((d) => ({
        '@type': 'Offer',
        name: `${s.name} (${d.minutes} min)`,
        price: price(d.price_cents),
        priceCurrency: CURRENCY,
        itemOffered: {
          '@type': 'Service',
          name: s.name,
          ...(s.description ? { description: s.description } : {}),
          ...(s.category ? { category: s.category } : {}),
        },
      })),
    ),
  };

  if (business.agent_enabled) {
    jsonLd.potentialAction = {
      '@type': 'ReserveAction',
      name: 'Book an appointment directly',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: bookingUrl,
        inLanguage: ['de', 'en'],
        actionPlatform: ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform'],
      },
      result: { '@type': 'Reservation', name: `Appointment at ${business.name}` },
    };
  }
  return jsonLd;
}

export function buildHeadTags(manifest: Manifest, origin: string): HeadTags {
  const { name, location, agent_enabled: isBookable } = manifest.business;
  const place = location?.city ? ` · ${location.city}` : '';
  return {
    title: `${name}${place}${isBookable ? ' · Book online' : ''}`,
    description: describe(manifest),
    jsonLd: buildJsonLd(manifest, origin),
  };
}

export function buildLlmsTxt(manifest: Manifest, origin: string): string {
  const { business } = manifest;
  const lines = [`# ${business.name}`, '', `> ${describe(manifest)}`, ''];
  if (business.location?.address || business.location?.city) {
    lines.push(`Address: ${[business.location.address, business.location.city].filter(Boolean).join(', ')}`, '');
  }

  lines.push('## Services', '');
  for (const s of manifest.services) {
    for (const d of s.durations) lines.push(`- ${s.name}, ${d.minutes} min, ${price(d.price_cents)} ${CURRENCY}`);
  }

  const hours = openingHours(manifest);
  if (hours.length) {
    lines.push('', '## Opening hours', '');
    for (const h of hours) lines.push(`- ${DAY_NAMES[h.day]}: ${h.opens}–${h.closes}`);
  }

  lines.push('', '## Booking', '');
  if (business.agent_enabled) {
    lines.push(
      'This business accepts direct bookings from AI assistants. No account or sign-in is needed.',
      `- Free times and booking form (plain HTML, no JavaScript): ${origin}${AI_BOOKING_PATH}`,
      `- Machine-readable version: ${origin}${AI_BOOKING_PATH}?format=json`,
      'Always confirm the service, date and time with the customer before booking.',
    );
  } else {
    lines.push(`Book online at ${origin}/`);
  }
  return `${lines.join('\n')}\n`;
}

// --- HTML injection ---------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** JSON safe inside <script>: no "</script>" or HTML comment break-outs. */
export const scriptSafeJson = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export function injectHeadTags(html: string, tags: HeadTags): string {
  const title = escapeHtml(tags.title);
  const description = escapeHtml(tags.description);
  const withTitle = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  const withDescription = withTitle.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}" />`,
  );
  const extra = [
    `<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt" />`,
    `<script type="application/ld+json">${scriptSafeJson(tags.jsonLd)}</script>`,
  ].join('\n    ');
  return withDescription.replace('</head>', `    ${extra}\n  </head>`);
}
