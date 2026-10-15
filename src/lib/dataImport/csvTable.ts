/**
 * CSV tables for moving a shop from another booking system (EasyWeek, Shore,
 * Treatwell, ...): read the file, then map its columns onto our fields by
 * German / English header names. Unmatched fields can be mapped by hand.
 */
import { detectDelimiter, parseCsvLine } from '../../components/admin/giftCardImport/parseGiftCardCsv';

export const MAX_IMPORT_ROWS = 5000;

export interface CsvTable {
  headers: string[];
  rows: string[][];
  /** 1-based line numbers of the rows in the file (for error messages). */
  lineNumbers: number[];
}

export function readCsvTable(text: string): CsvTable {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [], lineNumbers: [] };
  const delimiter = detectDelimiter(lines[0].line);
  const body = lines.slice(1, MAX_IMPORT_ROWS + 1);
  return {
    headers: parseCsvLine(lines[0].line, delimiter),
    rows: body.map(({ line }) => parseCsvLine(line, delimiter)),
    lineNumbers: body.map(({ number }) => number),
  };
}

export type ImportKind = 'customers' | 'bookings' | 'timeBlocks';

export interface FieldSpec {
  key: string;
  label: string;
  aliases: string[];
}

const NAME: FieldSpec = { key: 'name', label: 'Full name', aliases: ['name', 'kunde', 'kundenname', 'client', 'client name', 'customer', 'customer name', 'vollständiger name'] };
const FIRST: FieldSpec = { key: 'firstName', label: 'First name', aliases: ['vorname', 'first name', 'firstname', 'given name'] };
const LAST: FieldSpec = { key: 'lastName', label: 'Last name', aliases: ['nachname', 'last name', 'lastname', 'surname', 'family name'] };
const EMAIL: FieldSpec = { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'e mail', 'email address', 'e-mail-adresse', 'mail'] };
const PHONE: FieldSpec = { key: 'phone', label: 'Phone', aliases: ['phone', 'telefon', 'telefonnummer', 'handy', 'mobil', 'mobile', 'phone number', 'tel'] };

const NEWSLETTER: FieldSpec = { key: 'newsletter', label: 'Newsletter', aliases: ['newsletter', 'marketing', 'werbung', 'opt-in', 'optin', 'email marketing', 'marketing consent', 'e-mail-werbung'] };

export const IMPORT_FIELDS: Record<ImportKind, FieldSpec[]> = {
  customers: [NAME, FIRST, LAST, EMAIL, PHONE, NEWSLETTER],
  bookings: [
    { key: 'date', label: 'Date', aliases: ['datum', 'date', 'termin', 'tag', 'appointment date', 'start date', 'startdatum'] },
    { key: 'time', label: 'Start time', aliases: ['uhrzeit', 'time', 'start', 'beginn', 'startzeit', 'start time', 'von'] },
    { key: 'duration', label: 'Duration', aliases: ['dauer', 'duration', 'länge', 'minuten', 'minutes'] },
    { key: 'service', label: 'Treatment', aliases: ['dienstleistung', 'leistung', 'service', 'behandlung', 'appointment type', 'treatment'] },
    { key: 'specialist', label: 'Therapist', aliases: ['mitarbeiter', 'mitarbeiterin', 'staff', 'employee', 'therapeut', 'therapeutin', 'provider', 'resource', 'ressource', 'calendar'] },
    NAME, FIRST, LAST, EMAIL, PHONE,
    { key: 'notes', label: 'Notes', aliases: ['kommentar', 'notiz', 'notizen', 'notes', 'note', 'bemerkung', 'comment'] },
  ],
  timeBlocks: [
    { key: 'start', label: 'Start (date + time)', aliases: ['start', 'beginn', 'von', 'from', 'start date', 'startdatum'] },
    { key: 'end', label: 'End (date + time)', aliases: ['ende', 'end', 'bis', 'to', 'end date', 'enddatum'] },
    { key: 'specialist', label: 'Therapist (empty = whole shop)', aliases: ['mitarbeiter', 'mitarbeiterin', 'staff', 'employee', 'therapeut', 'resource', 'ressource'] },
    { key: 'reason', label: 'Reason', aliases: ['grund', 'reason', 'titel', 'title', 'beschreibung', 'description', 'notiz'] },
  ],
};

export type ColumnMapping = Record<string, number | null>;

const normalize = (header: string) => header.trim().toLowerCase().replace(/[_*:]/g, ' ').replace(/\s+/g, ' ');

/** Field -> column index (or null) by exact alias match on the header text. */
export function autoMap(kind: ImportKind, headers: string[]): ColumnMapping {
  const normalized = headers.map(normalize);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const field of IMPORT_FIELDS[kind]) {
    const index = normalized.findIndex((header, i) => !used.has(i) && field.aliases.includes(header));
    mapping[field.key] = index >= 0 ? index : null;
    if (index >= 0) used.add(index);
  }
  return mapping;
}
