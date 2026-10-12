/**
 * Conversions for <input type="datetime-local">, which shows and returns local
 * wall-clock time without a zone ("2026-10-19T09:00"). Stored values are
 * timestamptz instants (ISO strings).
 */

const pad = (value: number) => String(value).padStart(2, '0');

function formatLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local calendar day as YYYY-MM-DD (toISOString() would shift it to the UTC day). */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Stored instant -> value for a datetime-local input ('' when invalid). */
export function toDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatLocal(date);
}

const LOCAL_VALUE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** datetime-local input value -> ISO instant (null when empty or invalid). */
export function fromDateTimeLocalValue(value: string): string | null {
  const match = LOCAL_VALUE.exec(value);
  if (!match) return null;
  const [year, month, day, hours, minutes] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  const isSameWallClock = date.getFullYear() === year && date.getMonth() === month - 1
    && date.getDate() === day && date.getHours() === hours && date.getMinutes() === minutes;
  return isSameWallClock ? date.toISOString() : null;
}

const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 17;

/** Suggested new block: tomorrow 09:00-17:00, or the whole of tomorrow for a closure. */
export function defaultBlockRange(now: Date, options: { wholeDay?: boolean } = {}): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, options.wholeDay ? 0 : WORKDAY_START_HOUR);
  const end = options.wholeDay
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate(), WORKDAY_END_HOUR);
  return { start: formatLocal(start), end: formatLocal(end) };
}
