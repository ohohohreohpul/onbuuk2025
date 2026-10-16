import { toLocalDateString } from '../../../lib/localDateTime';
import { addDays } from './calendarModel';
import type { CalendarBlock } from './useCalendarData';

/** 'shop' = whole-shop closure (time_blocks.specialist_id NULL). */
export type BlockOwner = string | 'shop' | null;

export interface BlockDraft {
  owner: BlockOwner;
  date: string;
  start: string;
  end: string;
}

const DAY_START = '00:00';
const pad = (value: number) => String(value).padStart(2, '0');
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Draft for editing a stored block. */
export function draftFromBlock(block: CalendarBlock): BlockDraft & { lastDay: string; isWholeDay: boolean } {
  const start = new Date(block.start_time);
  const end = new Date(block.end_time);
  const isWholeDay = clock(start) === DAY_START && clock(end) === DAY_START;
  const lastDay = isWholeDay ? addDays(end, -1) : end;
  return {
    owner: block.specialist_id ?? 'shop',
    date: toLocalDateString(start),
    start: clock(start),
    end: clock(end),
    lastDay: toLocalDateString(lastDay),
    isWholeDay,
  };
}


const PHONE_PATTERN = /\+?\d[\d\s/-]{5,}\d/;
const MIN_PHONE_DIGITS = 6;

/** First phone number in a reservation comment ("Fr. Astred 017681277816 GS"), digits only. */
export function phoneFromText(text: string | null): string {
  const match = text?.match(PHONE_PATTERN)?.[0] ?? '';
  const digits = match.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= MIN_PHONE_DIGITS ? digits : '';
}
