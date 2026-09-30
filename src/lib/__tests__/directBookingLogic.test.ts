import { describe, test, expect } from 'vitest';
import {
  MAX_BOOKINGS_PER_BUSINESS,
  MAX_ATTEMPTS_PER_CLIENT,
  validateAvailabilityInput,
  validateBookingInput,
  localIso,
  earliestStart,
  mergeSlots,
  rateLimitReason,
} from '../../../supabase/functions/_shared/directBookingLogic';

const DURATION = '00000000-0000-4000-a000-00000000e2e2';
const STAFF = '00000000-0000-4000-a000-00000000e2e3';

const validBooking = {
  permalink: 'mira',
  durationId: DURATION,
  date: '2026-10-02',
  time: '14:30',
  name: ' Jane Doe ',
  email: 'Jane@Example.com',
  phone: '+49 40 123456',
  confirm: true,
};

describe('validateAvailabilityInput', () => {
  test('accepts a complete request', () => {
    expect(validateAvailabilityInput({ permalink: 'mira', durationId: DURATION, date: '2026-10-02' })).toEqual({
      ok: true,
      value: { permalink: 'mira', durationId: DURATION, date: '2026-10-02' },
    });
  });
  test('lists every problem', () => {
    const result = validateAvailabilityInput({ durationId: 'x', date: 'tomorrow' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(3);
  });
});

describe('validateBookingInput', () => {
  test('normalises a valid booking', () => {
    const result = validateBookingInput(validBooking);
    expect(result).toMatchObject({ ok: true, value: { name: 'Jane Doe', email: 'jane@example.com', specialistId: undefined } });
  });

  test('accepts HTML form values for confirm and keeps optional fields', () => {
    const result = validateBookingInput({ ...validBooking, confirm: 'on', specialistId: STAFF, customerRequest: 'book it' });
    expect(result).toMatchObject({ ok: true, value: { confirm: true, specialistId: STAFF, customerRequest: 'book it' } });
  });

  test('refuses to book without explicit customer confirmation', () => {
    const result = validateBookingInput({ ...validBooking, confirm: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/confirm must be true/);
  });

  test('rejects bad contact details, time and staff id', () => {
    const result = validateBookingInput({ ...validBooking, email: 'nope', phone: 'call me', time: '25:00', specialistId: 'x', name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(5);
  });

  test('includes base errors when the slot fields are missing', () => {
    const result = validateBookingInput({ ...validBooking, permalink: '' });
    expect(result.ok).toBe(false);
  });
});

describe('time helpers', () => {
  test('localIso formats Berlin wall-clock time', () => {
    expect(localIso(new Date('2026-10-01T10:30:00Z'), 'Europe/Berlin')).toBe('2026-10-01T12:30:00');
  });
  test('earliestStart adds the minimum notice', () => {
    expect(earliestStart(new Date('2026-10-01T10:30:00Z'), 120)).toBe('2026-10-01T14:30:00');
  });
});

describe('mergeSlots', () => {
  test('keeps the first free staff member per time, drops too-early slots, sorts and limits', () => {
    const slots = [
      { time: '15:00', startsAt: '2026-10-01T15:00:00', specialistId: 'b' },
      { time: '15:00', startsAt: '2026-10-01T15:00:00', specialistId: 'a' },
      { time: '09:00', startsAt: '2026-10-01T09:00:00', specialistId: 'a' },
      { time: '16:00', startsAt: '2026-10-01T16:00:00', specialistId: 'a' },
    ];
    expect(mergeSlots(slots, '2026-10-01T12:00:00', 1)).toEqual([slots[0]]);
    expect(mergeSlots(slots, '2026-10-01T12:00:00')).toHaveLength(2);
  });
});

describe('rateLimitReason', () => {
  test('allows normal traffic and blocks at either cap', () => {
    expect(rateLimitReason({ business: 0, client: 0 })).toBeNull();
    expect(rateLimitReason({ business: MAX_BOOKINGS_PER_BUSINESS, client: 0 })).toMatch(/many AI bookings/);
    expect(rateLimitReason({ business: 0, client: MAX_ATTEMPTS_PER_CLIENT })).toMatch(/Too many/);
  });
});
