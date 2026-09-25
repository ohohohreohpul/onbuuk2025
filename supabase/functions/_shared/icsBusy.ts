import ICAL from "npm:ical.js@2.1.0";

/**
 * Turns an iCal (.ics) file into busy time spans. Only times leave this module:
 * titles, attendees and notes are never read or stored.
 */

export type BusySpan =
  | { start: string; end: string }
  | { date: string; days: number };

export interface BusyWindow {
  from: Date;
  to: Date;
}

/**
 * Steps through a repeating event at most this often (a daily event since 2000
 * needs ~9,500), so one bad rule can't stall the sync.
 */
const MAX_RECURRENCE_STEPS = 20_000;
/** Upper bound on spans returned for one calendar (matches the database limit). */
export const MAX_SPANS = 5000;

const DEFAULT_EVENT_MINUTES = 60;

type IcalTime = InstanceType<typeof ICAL.Time>;

function isFree(vevent: { getFirstPropertyValue(name: string): unknown }): boolean {
  const transparency = String(vevent.getFirstPropertyValue("transp") ?? "").toUpperCase();
  const status = String(vevent.getFirstPropertyValue("status") ?? "").toUpperCase();
  return transparency === "TRANSPARENT" || status === "CANCELLED";
}

function dayCount(start: IcalTime, end: IcalTime): number {
  const ms = end.toJSDate().getTime() - start.toJSDate().getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

function toSpan(start: IcalTime, end: IcalTime | null): BusySpan | null {
  if (start.isDate) {
    // All-day: kept as a local date so the database places it in the shop's timezone.
    const days = end && end.isDate ? dayCount(start, end) : 1;
    return { date: start.toString().slice(0, 10), days };
  }
  const startDate = start.toJSDate();
  const endDate = end
    ? end.toJSDate()
    : new Date(startDate.getTime() + DEFAULT_EVENT_MINUTES * 60_000);
  if (!(endDate > startDate)) return null;
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

function spanOverlaps(span: BusySpan, window: BusyWindow): boolean {
  if ("date" in span) {
    const start = new Date(`${span.date}T00:00:00Z`).getTime();
    const end = start + span.days * 86_400_000;
    // One day of slack either side covers any timezone offset.
    return start < window.to.getTime() + 86_400_000 && end > window.from.getTime() - 86_400_000;
  }
  return new Date(span.start) < window.to && new Date(span.end) > window.from;
}

/** Registers the file's own timezone definitions so local times convert correctly. */
function registerTimezones(root: InstanceType<typeof ICAL.Component>): void {
  for (const vtimezone of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(vtimezone);
    } catch {
      // A broken definition falls back to floating time for that zone.
    }
  }
}

export function parseBusySpans(icsText: string, window: BusyWindow): BusySpan[] {
  const root = new ICAL.Component(ICAL.parse(icsText));
  registerTimezones(root);

  const vevents = root.getAllSubcomponents("vevent");
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  const exceptions: InstanceType<typeof ICAL.Event>[] = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    if (vevent.hasProperty("recurrence-id")) {
      exceptions.push(event);
    } else if (event.uid) {
      masters.set(event.uid, event);
    } else {
      masters.set(`no-uid-${masters.size}`, event);
    }
  }

  // Moved or cancelled single occurrences of a repeating event.
  const orphanExceptions: InstanceType<typeof ICAL.Event>[] = [];
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master && master.isRecurring()) {
      master.relateException(exception);
    } else {
      orphanExceptions.push(exception);
    }
  }

  const windowEnd = ICAL.Time.fromJSDate(window.to, true);
  const spans: BusySpan[] = [];
  const push = (span: BusySpan | null) => {
    if (span && spans.length < MAX_SPANS && spanOverlaps(span, window)) spans.push(span);
  };

  for (const event of [...masters.values(), ...orphanExceptions]) {
    if (spans.length >= MAX_SPANS) break;
    if (!event.startDate) continue;

    if (!event.isRecurring()) {
      if (!isFree(event.component)) push(toSpan(event.startDate, event.endDate));
      continue;
    }

    const iterator = event.iterator();
    for (let step = 0; step < MAX_RECURRENCE_STEPS; step++) {
      const next = iterator.next();
      if (!next || next.compare(windowEnd) > 0) break;
      const occurrence = event.getOccurrenceDetails(next);
      if (isFree(occurrence.item.component)) continue;
      push(toSpan(occurrence.startDate, occurrence.endDate));
    }
  }

  return spans;
}
