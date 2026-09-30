// ---------------------------------------------------------------------------
// Pure rules for keyless AI bookings (agent-direct edge function). No Deno
// APIs — tested by src/lib/__tests__/directBookingLogic.test.ts.
//
// Keyless on purpose (Jev, docs/DECISIONS.md): an AI booking gets the same
// access as the public human booking form (name, email, phone), plus the
// guardrails below.
// ---------------------------------------------------------------------------

export const BUSINESS_TIMEZONE = "Europe/Berlin";
/** Max AI bookings per business per window — cannot be spoofed by callers. */
export const MAX_BOOKINGS_PER_BUSINESS = 30;
/** Max AI booking attempts per client address per window. */
export const MAX_ATTEMPTS_PER_CLIENT = 10;
export const RATE_WINDOW_MINUTES = 60;
export const MAX_SLOTS_RETURNED = 40;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PHONE = /^[+\d][\d\s()/-]{4,24}$/;
const MAX_NAME = 100;
const MAX_REQUEST_TEXT = 500;

export interface DirectBookingInput {
  permalink: string;
  durationId: string;
  date: string;
  time: string;
  specialistId?: string;
  name: string;
  email: string;
  phone: string;
  confirm: boolean;
  customerRequest?: string;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validateAvailabilityInput(
  body: Record<string, unknown>,
): Validation<{ permalink: string; durationId: string; date: string }> {
  const permalink = str(body.permalink);
  const durationId = str(body.durationId);
  const date = str(body.date);
  const errors = [
    !permalink && "permalink is required",
    !UUID.test(durationId) && "durationId must be a service duration id",
    !DATE.test(date) && "date must be YYYY-MM-DD",
  ].filter(Boolean) as string[];
  return errors.length ? { ok: false, errors } : { ok: true, value: { permalink, durationId, date } };
}

export function validateBookingInput(body: Record<string, unknown>): Validation<DirectBookingInput> {
  const base = validateAvailabilityInput(body);
  const time = str(body.time);
  const specialistId = str(body.specialistId);
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const customerRequest = str(body.customerRequest).slice(0, MAX_REQUEST_TEXT);
  const confirm = body.confirm === true || body.confirm === "true" || body.confirm === "on";

  const errors = [
    ...(base.ok ? [] : base.errors),
    !TIME.test(time) && "time must be HH:MM",
    specialistId && !UUID.test(specialistId) && "specialistId must be a staff id",
    (!name || name.length > MAX_NAME) && "name is required (max 100 characters)",
    !EMAIL.test(email) && "a valid email is required",
    !PHONE.test(phone) && "a valid phone number is required",
    !confirm && "confirm must be true: only book after the customer explicitly agreed to this service, date and time",
  ].filter(Boolean) as string[];

  if (errors.length || !base.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...base.value,
      time,
      specialistId: specialistId || undefined,
      name,
      email,
      phone,
      confirm,
      customerRequest: customerRequest || undefined,
    },
  };
}

/** "YYYY-MM-DDTHH:MM:00" wall-clock time in `timeZone`, comparable with slot startsAt. */
export function localIso(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`;
}

/** Earliest bookable local start time given the business's minimum notice. */
export const earliestStart = (now: Date, leadMinutes: number, timeZone = BUSINESS_TIMEZONE): string =>
  localIso(new Date(now.getTime() + leadMinutes * 60_000), timeZone);

export interface SpecialistSlot {
  time: string;
  startsAt: string;
  specialistId: string;
}

/** One entry per start time (first free staff member), after the notice cut-off, sorted. */
export function mergeSlots(slots: SpecialistSlot[], earliest: string, limit = MAX_SLOTS_RETURNED): SpecialistSlot[] {
  const byTime = new Map<string, SpecialistSlot>();
  for (const s of slots) {
    if (s.startsAt < earliest || byTime.has(s.startsAt)) continue;
    byTime.set(s.startsAt, s);
  }
  return [...byTime.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, limit);
}

export function rateLimitReason(counts: { business: number; client: number }): string | null {
  if (counts.business >= MAX_BOOKINGS_PER_BUSINESS) return "This business has received many AI bookings in the last hour. Please try again later.";
  if (counts.client >= MAX_ATTEMPTS_PER_CLIENT) return "Too many booking attempts. Please try again later.";
  return null;
}
