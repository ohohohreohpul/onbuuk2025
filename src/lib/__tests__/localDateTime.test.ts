import { describe, expect, it } from 'vitest';
import { defaultBlockRange, fromDateTimeLocalValue, toDateTimeLocalValue } from '../localDateTime';

describe('toDateTimeLocalValue', () => {
  it('shows a stored instant in local wall-clock time, in the datetime-local format', () => {
    // Arrange
    const instant = new Date(2026, 9, 19, 9, 5); // local 19.10.2026 09:05

    // Act
    const value = toDateTimeLocalValue(instant.toISOString());

    // Assert
    expect(value).toBe('2026-10-19T09:05');
  });

  it('accepts the +00:00 format the database returns', () => {
    const instant = new Date(2026, 9, 19, 14, 30);
    const fromDatabase = instant.toISOString().replace('Z', '+00:00');

    expect(toDateTimeLocalValue(fromDatabase)).toBe('2026-10-19T14:30');
  });

  it('returns an empty string for an invalid value instead of throwing', () => {
    expect(toDateTimeLocalValue('not a date')).toBe('');
  });
});

describe('fromDateTimeLocalValue', () => {
  it('round-trips with toDateTimeLocalValue', () => {
    const iso = fromDateTimeLocalValue('2026-12-24T08:00');

    expect(toDateTimeLocalValue(iso as string)).toBe('2026-12-24T08:00');
  });

  it('returns null for an empty or invalid input', () => {
    expect(fromDateTimeLocalValue('')).toBeNull();
    expect(fromDateTimeLocalValue('2026-13-45T99:99')).toBeNull();
  });
});

describe('defaultBlockRange', () => {
  it('suggests tomorrow 09:00 to 17:00 local time', () => {
    const now = new Date(2026, 9, 12, 22, 40);

    expect(defaultBlockRange(now)).toEqual({ start: '2026-10-13T09:00', end: '2026-10-13T17:00' });
  });

  it('suggests the whole day for a shop closure', () => {
    const now = new Date(2026, 11, 31, 10, 0);

    expect(defaultBlockRange(now, { wholeDay: true })).toEqual({ start: '2027-01-01T00:00', end: '2027-01-02T00:00' });
  });
});
