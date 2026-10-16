/**
 * Pure calendar maths for the admin calendar workspace: time <-> minutes,
 * week dates (Monday first, as in Germany), the visible hour range and
 * side-by-side lanes for overlapping appointments.
 */

export const MINUTES_PER_HOUR = 60;
export const SLOT_STEP_MINUTES = 15;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 20;
const DAYS_PER_WEEK = 7;

const pad = (value: number) => String(value).padStart(2, '0');

/** "14:30" or "14:30:00" -> 870. */
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * MINUTES_PER_HOUR + (minutes || 0);
}

/** 870 -> "14:30". */
export function fromMinutes(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * MINUTES_PER_HOUR - 1, Math.round(totalMinutes)));
  return `${pad(Math.floor(clamped / MINUTES_PER_HOUR))}:${pad(clamped % MINUTES_PER_HOUR)}`;
}

/** Rounds down to the slot grid (15 minutes). */
export function snapMinutes(totalMinutes: number, step = SLOT_STEP_MINUTES): number {
  return Math.floor(totalMinutes / step) * step;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  const mondayOffset = (date.getDay() + 6) % DAYS_PER_WEEK;
  return addDays(startOfDay(date), -mondayOffset);
}

export function weekDates(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => addDays(monday, i));
}

/** Month grid cells, Monday first; null pads the first week. */
export function monthCells(date: Date): (Date | null)[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % DAYS_PER_WEEK;
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1)),
  ];
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface MinuteRange {
  startMin: number;
  endMin: number;
}

/**
 * Part of a stored block (timestamptz instants) that falls on the local day
 * `day`, in minutes since midnight; null when it doesn't touch that day.
 */
export function blockRangeOnDay(block: { start_time: string; end_time: string }, day: Date): MinuteRange | null {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(day, 1).getTime();
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end.getTime() <= dayStart || start.getTime() >= dayEnd) return null;
  // Wall-clock minutes, so the 23/25-hour daylight-saving days line up with appointments.
  const wallClock = (date: Date) => date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
  return {
    startMin: start.getTime() <= dayStart ? 0 : wallClock(start),
    endMin: end.getTime() >= dayEnd ? 24 * MINUTES_PER_HOUR : wallClock(end),
  };
}

/**
 * Hours to draw: from the earliest opening to the latest closing of the
 * working hours, widened so every appointment fits. Falls back to 09-20.
 */
export function visibleHourRange(
  openRanges: MinuteRange[],
  items: MinuteRange[],
): { startHour: number; endHour: number } {
  const all = [...openRanges, ...items];
  if (all.length === 0) return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  const earliest = Math.min(...all.map((r) => r.startMin));
  const latest = Math.max(...all.map((r) => r.endMin));
  const startHour = Math.max(0, Math.floor(earliest / MINUTES_PER_HOUR));
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(latest / MINUTES_PER_HOUR)));
  return { startHour, endHour };
}

export interface Placed<T> {
  item: T;
  lane: number;
  laneCount: number;
}

/**
 * Puts overlapping items side by side. Items are grouped into clusters of
 * transitive overlap; every item in a cluster shares the cluster's lane count.
 */
export function layoutLanes<T extends MinuteRange>(items: T[]): Placed<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const result: Placed<T>[] = [];
  let cluster: { item: T; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const laneCount = Math.max(1, laneEnds.length);
    cluster.forEach(({ item, lane }) => result.push({ item, lane, laneCount }));
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) flush();
    const freeLane = laneEnds.findIndex((end) => end <= item.startMin);
    const lane = freeLane === -1 ? laneEnds.length : freeLane;
    laneEnds = laneEnds.map((end, i) => (i === lane ? item.endMin : end));
    if (lane === laneEnds.length) laneEnds = [...laneEnds, item.endMin];
    cluster = [...cluster, { item, lane }];
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return result;
}

export interface StaffColor {
  bg: string;
  border: string;
  text: string;
}

/** Calm, distinguishable colours for therapists (background, border, text). */
const STAFF_PALETTE: readonly StaffColor[] = [
  { bg: '#EEF2FF', border: '#818CF8', text: '#312E81' },
  { bg: '#ECFDF5', border: '#34D399', text: '#064E3B' },
  { bg: '#FFF7ED', border: '#FB923C', text: '#7C2D12' },
  { bg: '#FDF2F8', border: '#F472B6', text: '#831843' },
  { bg: '#F0F9FF', border: '#38BDF8', text: '#0C4A6E' },
  { bg: '#FEFCE8', border: '#EAB308', text: '#713F12' },
  { bg: '#F5F3FF', border: '#A78BFA', text: '#4C1D95' },
  { bg: '#F0FDFA', border: '#2DD4BF', text: '#134E4A' },
];

const NEUTRAL_COLOR: StaffColor = { bg: '#F5F5F4', border: '#A8A29E', text: '#292524' };

/** Stable colour per therapist, by their position in the sorted staff list. */
export function staffColor(staffIds: string[], specialistId: string | null): StaffColor {
  const index = specialistId ? staffIds.indexOf(specialistId) : -1;
  return index === -1 ? NEUTRAL_COLOR : STAFF_PALETTE[index % STAFF_PALETTE.length];
}

/** Colours a blocked time can have (like a quick phone reservation); null = grey. */
export const BLOCK_COLORS = ['#22C55E', '#3B82F6', '#06B6D4', '#A855F7', '#EC4899', '#EF4444', '#F97316', '#EAB308'] as const;
const DEFAULT_BLOCK_COLOR = '#A8A29E';

/** Striped background for a blocked time in its colour. */
export function blockStripes(color: string | null): { background: string; borderColor: string } {
  const base = color ?? DEFAULT_BLOCK_COLOR;
  return {
    background: `repeating-linear-gradient(135deg, ${base}26 0 8px, ${base}47 8px 16px)`,
    borderColor: base,
  };
}
