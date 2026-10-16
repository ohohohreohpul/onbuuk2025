import { describe, expect, it } from 'vitest';
import {
  blockRangeOnDay,
  fromMinutes,
  layoutLanes,
  monthCells,
  snapMinutes,
  staffColor,
  startOfWeek,
  toMinutes,
  visibleHourRange,
  weekDates,
} from '../../components/admin/calendar/calendarModel';

describe('time conversion', () => {
  it('converts clock strings to minutes and back', () => {
    expect(toMinutes('14:30')).toBe(870);
    expect(toMinutes('09:05:00')).toBe(545);
    expect(fromMinutes(870)).toBe('14:30');
    expect(fromMinutes(-5)).toBe('00:00');
  });

  it('snaps to the 15-minute grid', () => {
    expect(snapMinutes(874)).toBe(870);
    expect(snapMinutes(885)).toBe(885);
  });
});

describe('weeks and months', () => {
  it('starts weeks on Monday', () => {
    const sunday = new Date(2026, 9, 18);
    expect(startOfWeek(sunday).getDate()).toBe(12);
    expect(weekDates(sunday).map((d) => d.getDate())).toEqual([12, 13, 14, 15, 16, 17, 18]);
  });

  it('pads the month grid so the 1st falls on its weekday', () => {
    const cells = monthCells(new Date(2026, 9, 16)); // October 2026 starts on a Thursday
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]?.getDate()).toBe(1);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
});

describe('blockRangeOnDay', () => {
  const day = new Date(2026, 9, 16);
  const iso = (h: number, m = 0, d = 16) => new Date(2026, 9, d, h, m).toISOString();

  it('returns the minutes of a block inside the day', () => {
    expect(blockRangeOnDay({ start_time: iso(12), end_time: iso(13, 30) }, day)).toEqual({ startMin: 720, endMin: 810 });
  });

  it('clips multi-day blocks to the day', () => {
    expect(blockRangeOnDay({ start_time: iso(18, 0, 15), end_time: iso(10, 0, 17) }, day)).toEqual({ startMin: 0, endMin: 1440 });
  });

  it('uses wall-clock minutes on the daylight-saving change day', () => {
    const dstDay = new Date(2026, 9, 25); // Europe: clocks go back at 03:00
    const block = { start_time: new Date(2026, 9, 25, 10).toISOString(), end_time: new Date(2026, 9, 25, 11).toISOString() };
    expect(blockRangeOnDay(block, dstDay)).toEqual({ startMin: 600, endMin: 660 });
  });

  it('returns null when the block is on another day', () => {
    expect(blockRangeOnDay({ start_time: iso(9, 0, 17), end_time: iso(10, 0, 17) }, day)).toBeNull();
  });
});

describe('visibleHourRange', () => {
  it('falls back to 09-20 without data', () => {
    expect(visibleHourRange([], [])).toEqual({ startHour: 9, endHour: 20 });
  });

  it('widens opening hours so late appointments fit', () => {
    const open = [{ startMin: 600, endMin: 1140 }];
    const late = [{ startMin: 1170, endMin: 1230 }];
    expect(visibleHourRange(open, late)).toEqual({ startHour: 10, endHour: 21 });
  });
});

describe('layoutLanes', () => {
  it('keeps separate appointments in one lane', () => {
    const placed = layoutLanes([
      { id: 'a', startMin: 600, endMin: 660 },
      { id: 'b', startMin: 660, endMin: 720 },
    ]);
    expect(placed.map((p) => [p.item.id, p.lane, p.laneCount])).toEqual([['a', 0, 1], ['b', 0, 1]]);
  });

  it('puts overlapping appointments side by side and reuses free lanes', () => {
    const placed = layoutLanes([
      { id: 'a', startMin: 600, endMin: 720 },
      { id: 'b', startMin: 630, endMin: 690 },
      { id: 'c', startMin: 690, endMin: 750 },
    ]);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
    expect(byId.a.lane).toBe(0);
    expect(byId.b.lane).toBe(1);
    expect(byId.c.lane).toBe(1);
    expect(placed.every((p) => p.laneCount === 2)).toBe(true);
  });

  it('does not mutate the input', () => {
    const input = [{ startMin: 700, endMin: 760 }, { startMin: 600, endMin: 660 }];
    layoutLanes(input);
    expect(input[0].startMin).toBe(700);
  });
});

describe('staffColor', () => {
  it('is stable per therapist and neutral for unknown ones', () => {
    expect(staffColor(['x', 'y'], 'y')).toEqual(staffColor(['x', 'y'], 'y'));
    expect(staffColor(['x', 'y'], 'x')).not.toEqual(staffColor(['x', 'y'], 'y'));
    expect(staffColor(['x'], null).border).toBe('#A8A29E');
  });
});
