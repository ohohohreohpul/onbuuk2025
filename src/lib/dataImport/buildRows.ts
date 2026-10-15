/**
 * Turns a mapped CSV table into rows ready to save, with one readable error per
 * skipped line. Nothing is written here.
 */
import type { ColumnMapping, CsvTable } from './csvTable';
import { localInstant, parseDate, parseDuration, parseTime } from './values';

export interface CatalogLookup {
  services: { id: string; name: string; durations: { id: string; minutes: number }[] }[];
  specialists: { id: string; name: string }[];
}

export interface BuildResult<T> {
  rows: T[];
  errors: string[];
}

export interface CustomerImportRow {
  name: string;
  email: string;
  phone: string | null;
  /** 'subscribed' when the export marks the customer as newsletter subscriber. */
  newsletter_status: 'subscribed' | null;
}

const SUBSCRIBED = /^(ja|yes|y|true|1|x|abonniert|abonnieren|subscribed|opt-?in|angemeldet)$/i;

export interface BookingImportRow {
  booking_date: string;
  start_time: string;
  service_id: string;
  duration_id: string;
  specialist_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
}

export interface TimeBlockImportRow {
  start_time: string;
  end_time: string;
  specialist_id: string | null;
  reason: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const key = (value: string) => value.trim().toLowerCase();

function cellReader(mapping: ColumnMapping) {
  return (row: string[], field: string) => {
    const index = mapping[field];
    return index === null || index === undefined ? '' : (row[index] ?? '').trim();
  };
}

/**
 * Full name. Many German exports have "Vorname" + "Name", where "Name" is only
 * the surname, so a first name not already in "Name" is put in front of it.
 */
function personName(get: (field: string) => string): string {
  const full = get('name');
  const first = get('firstName');
  if (full) return first && !key(full).startsWith(key(first)) ? `${first} ${full}` : full;
  return [first, get('lastName')].filter(Boolean).join(' ');
}

/** Exact name, else unique first-name / prefix match ("Anna" -> "Anna Berg"). */
function findSpecialist(name: string, specialists: CatalogLookup['specialists']) {
  if (!name) return { id: null as string | null };
  const wanted = key(name);
  const exact = specialists.find((s) => key(s.name) === wanted);
  if (exact) return { id: exact.id };
  const partial = specialists.filter((s) => key(s.name).split(/\s+/)[0] === wanted || key(s.name).startsWith(`${wanted} `));
  return partial.length === 1 ? { id: partial[0].id } : { id: null, error: `therapist "${name}" not found` };
}

export function buildCustomers(table: CsvTable, mapping: ColumnMapping): BuildResult<CustomerImportRow> {
  const read = cellReader(mapping);
  const seen = new Set<string>();
  const rows: CustomerImportRow[] = [];
  const errors: string[] = [];
  table.rows.forEach((row, i) => {
    const get = (field: string) => read(row, field);
    const line = table.lineNumbers[i];
    const email = key(get('email'));
    if (!EMAIL.test(email)) return errors.push(`Row ${line}: no valid email`);
    if (seen.has(email)) return errors.push(`Row ${line}: duplicate email ${email}`);
    seen.add(email);
    rows.push({
      name: personName(get) || email,
      email,
      phone: get('phone') || null,
      newsletter_status: SUBSCRIBED.test(get('newsletter').trim()) ? 'subscribed' : null,
    });
  });
  return { rows, errors };
}

export function buildBookings(table: CsvTable, mapping: ColumnMapping, catalog: CatalogLookup): BuildResult<BookingImportRow> {
  const read = cellReader(mapping);
  const servicesByName = new Map(catalog.services.map((s) => [key(s.name), s]));
  const rows: BookingImportRow[] = [];
  const errors: string[] = [];
  table.rows.forEach((row, i) => {
    const get = (field: string) => read(row, field);
    const fail = (message: string) => errors.push(`Row ${table.lineNumbers[i]}: ${message}`);
    const date = parseDate(get('date'));
    const time = parseTime(get('time')) ?? parseTime(get('date'));
    if (!date || !time) return fail('date or time missing / not readable');
    const service = servicesByName.get(key(get('service')));
    if (!service) return fail(`service "${get('service')}" not found`);
    const minutes = parseDuration(get('duration'));
    const duration = (minutes && service.durations.find((d) => d.minutes === minutes)) || service.durations[0];
    if (!duration) return fail(`service "${service.name}" has no duration`);
    const specialist = findSpecialist(get('specialist'), catalog.specialists);
    if ('error' in specialist && specialist.error) return fail(specialist.error);
    const email = key(get('email'));
    if (!EMAIL.test(email)) return fail('no valid customer email');
    rows.push({
      booking_date: date,
      start_time: time,
      service_id: service.id,
      duration_id: duration.id,
      specialist_id: specialist.id,
      customer_name: personName(get) || email,
      customer_email: email,
      customer_phone: get('phone'),
      notes: get('notes') || null,
    });
  });
  return { rows, errors };
}

export function buildTimeBlocks(table: CsvTable, mapping: ColumnMapping, catalog: CatalogLookup): BuildResult<TimeBlockImportRow> {
  const read = cellReader(mapping);
  const rows: TimeBlockImportRow[] = [];
  const errors: string[] = [];
  table.rows.forEach((row, i) => {
    const get = (field: string) => read(row, field);
    const fail = (message: string) => errors.push(`Row ${table.lineNumbers[i]}: ${message}`);
    const startDate = parseDate(get('start'));
    const endDate = parseDate(get('end'));
    if (!startDate || !endDate) return fail('start or end date missing / not readable');
    const start = localInstant(startDate, parseTime(get('start')) ?? '00:00');
    const end = localInstant(endDate, parseTime(get('end')) ?? '23:59');
    if (end <= start) return fail('end is not after start');
    const specialist = findSpecialist(get('specialist'), catalog.specialists);
    if ('error' in specialist && specialist.error) return fail(specialist.error);
    rows.push({ start_time: start, end_time: end, specialist_id: specialist.id, reason: get('reason') || null });
  });
  return { rows, errors };
}
