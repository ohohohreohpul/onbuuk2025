/** Cell parsers for imported files (German and international formats). */

const pad = (value: number) => String(value).padStart(2, '0');

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isValid ? `${year}-${pad(month)}-${pad(day)}` : null;
}

/** 21.10.2026 · 21/10/2026 · 2026-10-21 (a trailing time is ignored) -> 2026-10-21 */
export function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = value.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!dmy) return null;
  const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
  return validDate(year, Number(dmy[2]), Number(dmy[1]));
}

/** 9:30 · 09:30 · "21.10.2026 14:05" · "14:00 Uhr" -> 14:05 */
export function parseTime(raw: string): string | null {
  const match = raw.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*uhr)?\s*$/i) ?? raw.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
}

/** "60" · "60 min" · "1:30" · "1 h 15 min" · "1,5 h" -> minutes */
export function parseDuration(raw: string): number | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  const clock = value.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const hours = value.match(/(\d+(?:[.,]\d+)?)\s*(?:h|std|stunde|stunden|hour|hours)\b/);
  const minutes = value.match(/(\d+)\s*(?:m|min|minute|minuten|minutes)\b/);
  if (hours || minutes) {
    const total = (hours ? Number(hours[1].replace(',', '.')) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    return total > 0 ? Math.round(total) : null;
  }
  const plain = Number(value);
  return Number.isFinite(plain) && plain > 0 ? Math.round(plain) : null;
}

/** Local date + time -> ISO instant. */
export function localInstant(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}
