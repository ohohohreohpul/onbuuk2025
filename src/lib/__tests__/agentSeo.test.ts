import { describe, test, expect } from 'vitest';
import {
  AI_BOOKING_PATH,
  schemaType,
  openingHours,
  buildJsonLd,
  buildHeadTags,
  buildLlmsTxt,
  injectHeadTags,
  scriptSafeJson,
  type Manifest,
} from '../../../api/_lib/agentSeo';

const ORIGIN = 'https://mira.zennohq.com';

const manifest = (overrides: Partial<Manifest['business']> = {}): Manifest => ({
  business: {
    name: 'Salon Mira',
    permalink: 'mira',
    vertical: 'salon',
    location: { city: 'Hamburg', address: 'Osterstraße 12' },
    description: null,
    agent_enabled: true,
    ...overrides,
  },
  services: [
    { id: 's1', name: 'Haarschnitt', category: 'Hair', durations: [{ id: 'd1', minutes: 45, price_cents: 4500 }] },
  ],
  specialists: [
    { id: 'p1', name: 'Mira', working_hours: [{ day: 2, start: '10:00:00', end: '18:00:00', available: true }] },
    {
      id: 'p2',
      name: 'Lea',
      working_hours: [
        { day: 2, start: '09:00:00', end: '16:00:00', available: true },
        { day: 3, start: '09:00:00', end: '12:00:00', available: false },
      ],
    },
    { id: 'p3', name: 'Gone', active: false, working_hours: [{ day: 1, start: '08:00:00', end: '20:00:00', available: true }] },
  ],
});

describe('schemaType', () => {
  test('maps verticals to schema.org types and defaults to LocalBusiness', () => {
    expect(schemaType('barber')).toBe('HairSalon');
    expect(schemaType('wellness')).toBe('DaySpa');
    expect(schemaType('other')).toBe('LocalBusiness');
    expect(schemaType(null)).toBe('LocalBusiness');
  });
});

describe('openingHours', () => {
  test('merges active staff hours per day and skips unavailable days and inactive staff', () => {
    expect(openingHours(manifest())).toEqual([{ day: 2, opens: '09:00', closes: '18:00' }]);
  });
});

describe('buildJsonLd', () => {
  test('advertises a ReserveAction to the AI booking form when AI booking is on', () => {
    // Act
    const jsonLd = buildJsonLd(manifest(), ORIGIN);

    // Assert
    expect(jsonLd['@type']).toBe('HairSalon');
    expect(jsonLd.potentialAction).toMatchObject({
      '@type': 'ReserveAction',
      target: { urlTemplate: `${ORIGIN}${AI_BOOKING_PATH}` },
    });
    expect(jsonLd.makesOffer).toEqual([
      expect.objectContaining({ price: '45.00', priceCurrency: 'EUR', name: 'Haarschnitt (45 min)' }),
    ]);
    expect(jsonLd.address).toEqual({ '@type': 'PostalAddress', streetAddress: 'Osterstraße 12', addressLocality: 'Hamburg' });
  });

  test('omits the booking action and empty address parts when AI booking is off', () => {
    const jsonLd = buildJsonLd(manifest({ agent_enabled: false, location: {} }), ORIGIN);
    expect(jsonLd.potentialAction).toBeUndefined();
    expect(jsonLd.address).toEqual({ '@type': 'PostalAddress' });
  });
});

describe('buildHeadTags', () => {
  test('uses the business description when set, otherwise a generated one', () => {
    expect(buildHeadTags(manifest({ description: 'Colour specialists.' }), ORIGIN).description).toBe('Colour specialists.');
    const tags = buildHeadTags(manifest(), ORIGIN);
    expect(tags.title).toBe('Salon Mira · Hamburg · Book online');
    expect(tags.description).toBe('Book an appointment at Salon Mira in Hamburg.');
  });

  test('drops the city and booking suffix when unknown or off', () => {
    const tags = buildHeadTags(manifest({ location: {}, agent_enabled: false }), ORIGIN);
    expect(tags.title).toBe('Salon Mira');
    expect(tags.description).toBe('Book an appointment at Salon Mira.');
  });
});

describe('buildLlmsTxt', () => {
  test('lists services, hours and how an AI can book directly', () => {
    const text = buildLlmsTxt(manifest(), ORIGIN);
    expect(text).toContain('# Salon Mira');
    expect(text).toContain('Address: Osterstraße 12, Hamburg');
    expect(text).toContain('- Haarschnitt, 45 min, 45.00 EUR');
    expect(text).toContain('- Tuesday: 09:00–18:00');
    expect(text).toContain(`${ORIGIN}${AI_BOOKING_PATH}?format=json`);
  });

  test('falls back to the normal booking link when AI booking is off', () => {
    const text = buildLlmsTxt(manifest({ agent_enabled: false, location: {} }), ORIGIN);
    expect(text).toContain(`Book online at ${ORIGIN}/`);
    expect(text).not.toContain('Address:');
  });
});

describe('injectHeadTags', () => {
  const html =
    '<html><head><title>Zenno</title><meta name="description" content="Old." /></head><body></body></html>';

  test('replaces title and description and adds JSON-LD plus the llms.txt link', () => {
    const out = injectHeadTags(html, { title: 'A & B', description: 'Say "hi"', jsonLd: { name: 'x' } });
    expect(out).toContain('<title>A &amp; B</title>');
    expect(out).toContain('<meta name="description" content="Say &quot;hi&quot;" />');
    expect(out).toContain('<script type="application/ld+json">{"name":"x"}</script>');
    expect(out).toContain('href="/llms.txt"');
  });

  test('cannot be broken out of by a malicious business name', () => {
    const out = injectHeadTags(html, { title: 't', description: 'd', jsonLd: { name: '</script><script>alert(1)</script>' } });
    expect(out).not.toContain('</script><script>alert(1)');
    expect(scriptSafeJson({ a: '<&>' })).toBe('{"a":"\\u003c\\u0026\\u003e"}');
  });
});
