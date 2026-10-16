import type { CsvTable } from '../../../lib/dataImport/csvTable';

export interface ConsentRow {
  name: string;
  email: string;
  phone: string;
  consent: boolean;
}

const HEADER_ALIASES: Record<keyof ConsentRow, RegExp> = {
  name: /^(name|full ?name|kunde|kundin|kund:in|customer)$/i,
  email: /^(e-?mail|mail|email address|e-?mail-?adresse)$/i,
  phone: /^(phone|telefon|tel\.?|handy|mobil|mobile|whatsapp ?(nummer|number)?)$/i,
  consent: /^(consent|einwilligung|zustimmung|opt-?in|whatsapp ?(ok|consent|einwilligung)|marketing)$/i,
};
const FIRST_NAME = /^(vorname|first ?name)$/i;
const LAST_NAME = /^(nachname|last ?name|surname)$/i;
const YES = /^(yes|ja|j|y|true|1|x|✓|✔|ok|wahr)$/i;

/** Maps a CSV (German or English headers) to consent rows; consent only when the cell clearly says yes. */
export function consentRowsFromCsv(table: CsvTable): ConsentRow[] {
  const headers = table.headers.map((h) => h.trim());
  const column = (pattern: RegExp) => headers.findIndex((h) => pattern.test(h));
  const index = {
    name: column(HEADER_ALIASES.name),
    email: column(HEADER_ALIASES.email),
    phone: column(HEADER_ALIASES.phone),
    consent: column(HEADER_ALIASES.consent),
    first: column(FIRST_NAME),
    last: column(LAST_NAME),
  };
  const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
  return table.rows
    .map((row) => ({
      name: cell(row, index.name) || [cell(row, index.first), cell(row, index.last)].filter(Boolean).join(' '),
      email: cell(row, index.email).toLowerCase(),
      phone: cell(row, index.phone),
      consent: YES.test(cell(row, index.consent)),
    }))
    .filter((row) => row.email || row.phone);
}
