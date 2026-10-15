import { describe, expect, it } from 'vitest';
import { autoMap, readCsvTable } from '../csvTable';
import { parseDate, parseDuration, parseTime } from '../values';
import { buildBookings, buildCustomers, buildTimeBlocks, type CatalogLookup } from '../buildRows';

const EASYWEEK_LIKE = [
  'Datum;Uhrzeit;Dauer;Dienstleistung;Mitarbeiter;Kunde;E-Mail;Telefon;Kommentar',
  '21.10.2026;14:00;60 min;Thai Massage;Anna;Max Muster;max@example.de;+49 170 1;"Bitte, sanft"',
  '22.10.2026;09:30;;Thai Massage;;Erika Muster;erika@example.de;;',
  '23.10.2026;10:00;45;Unbekannt;Anna;Tom;tom@example.de;;',
].join('\n');

const CATALOG: CatalogLookup = {
  services: [{ id: 's1', name: 'Thai Massage', durations: [{ id: 'd60', minutes: 60 }, { id: 'd90', minutes: 90 }] }],
  specialists: [{ id: 'a', name: 'Anna Berg' }, { id: 'b', name: 'Ben' }],
};

describe('readCsvTable + autoMap', () => {
  it('reads a German semicolon export and maps the columns', () => {
    const table = readCsvTable(EASYWEEK_LIKE);

    expect(table.rows).toHaveLength(3);
    expect(table.rows[0][8]).toBe('Bitte, sanft');
    expect(autoMap('bookings', table.headers)).toMatchObject({
      date: 0, time: 1, duration: 2, service: 3, specialist: 4, name: 5, email: 6, phone: 7, notes: 8,
    });
  });

  it('maps English headers and split first/last names', () => {
    const mapping = autoMap('customers', ['First name', 'Last name', 'Email address', 'Mobile']);
    expect(mapping).toMatchObject({ firstName: 0, lastName: 1, email: 2, phone: 3 });
  });
});

describe('value parsing', () => {
  it('understands German and ISO dates', () => {
    expect(parseDate('21.10.2026')).toBe('2026-10-21');
    expect(parseDate('2026-10-21')).toBe('2026-10-21');
    expect(parseDate('21/10/2026')).toBe('2026-10-21');
    expect(parseDate('21.10.2026 14:00')).toBe('2026-10-21');
    expect(parseDate('31.02.2026')).toBeNull();
  });

  it('understands times and durations', () => {
    expect(parseTime('9:30')).toBe('09:30');
    expect(parseTime('21.10.2026 14:05')).toBe('14:05');
    expect(parseTime('14:00 Uhr')).toBe('14:00');
    expect(parseTime('25:00')).toBeNull();
    expect(parseDuration('60 min')).toBe(60);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('1 h 15 min')).toBe(75);
  });
});

describe('buildBookings', () => {
  it('builds valid rows, matches therapist by first name, reports unknown services', () => {
    const table = readCsvTable(EASYWEEK_LIKE);
    const result = buildBookings(table, autoMap('bookings', table.headers), CATALOG);

    expect(result.rows).toEqual([
      expect.objectContaining({ booking_date: '2026-10-21', start_time: '14:00', service_id: 's1', duration_id: 'd60', specialist_id: 'a', customer_email: 'max@example.de', notes: 'Bitte, sanft' }),
      expect.objectContaining({ booking_date: '2026-10-22', start_time: '09:30', duration_id: 'd60', specialist_id: null }),
    ]);
    expect(result.errors).toEqual(['Row 4: service "Unbekannt" not found']);
  });
});

describe('buildCustomers', () => {
  it('joins first and last name, skips rows without email, de-duplicates', () => {
    const table = readCsvTable('First name,Last name,Email\nMax,Muster,MAX@example.de\nNo,Mail,\nMax,M,max@example.de');
    const result = buildCustomers(table, autoMap('customers', table.headers));

    expect(result.rows).toEqual([{ name: 'Max Muster', email: 'max@example.de', phone: null, newsletter_status: null }]);
    expect(result.errors).toEqual(['Row 3: no valid email', 'Row 4: duplicate email max@example.de']);
  });
});

describe('buildTimeBlocks', () => {
  it('uses the specialist when named, else the whole shop', () => {
    const table = readCsvTable('Start;Ende;Mitarbeiter;Grund\n24.12.2026 00:00;27.12.2026 00:00;;Weihnachten\n21.10.2026 12:00;21.10.2026 13:00;Ben;Pause');
    const result = buildTimeBlocks(table, autoMap('timeBlocks', table.headers), CATALOG);

    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => [row.specialist_id, row.reason])).toEqual([[null, 'Weihnachten'], ['b', 'Pause']]);
    expect(new Date(result.rows[1].start_time).getHours()).toBe(12);
  });
});
