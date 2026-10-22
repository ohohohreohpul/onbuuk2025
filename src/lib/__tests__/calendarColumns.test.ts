import { describe, expect, it } from 'vitest';
import {
  bookingRange, columnBlocks, columnBookings, offRanges, shopOpenRange, visibleStaff, workRange,
} from '../../components/admin/calendar/calendarColumns';
import { draftFromBlock, phoneFromText } from '../../components/admin/calendar/blockDraft';
import type { CalendarBooking } from '../../components/admin/calendar/useCalendarData';

const friday = new Date(2026, 9, 16); // day_of_week 5
const hours = [
  { specialist_id: 'mali', day_of_week: 5, start_time: '10:00:00', end_time: '18:00:00', is_available: true },
  { specialist_id: 'noi', day_of_week: 5, start_time: '12:00:00', end_time: '20:00:00', is_available: true },
  { specialist_id: 'off', day_of_week: 5, start_time: '10:00:00', end_time: '18:00:00', is_available: false },
];

const booking = (over: Partial<CalendarBooking>): CalendarBooking => ({
  id: 'b1', customer_name: 'Anna', specialist_id: 'mali', partner_specialist_id: null,
  booking_date: '2026-10-16', start_time: '11:00:00', duration_id: 'd', total_duration_minutes: 90,
  status: 'confirmed', no_show: false, is_pair_booking: false, payment_status: 'pending', ...over,
});

describe('working hours', () => {
  it('reads one therapist and ignores days off', () => {
    expect(workRange(hours, 'mali', friday)).toEqual({ startMin: 600, endMin: 1080 });
    expect(workRange(hours, 'off', friday)).toBeNull();
    expect(workRange(hours, 'mali', new Date(2026, 9, 17))).toBeNull();
  });

  it('greys everything outside the open range', () => {
    expect(offRanges({ startMin: 600, endMin: 1080 }, 9, 20)).toEqual([
      { startMin: 540, endMin: 600 }, { startMin: 1080, endMin: 1200 },
    ]);
    expect(offRanges(null, 9, 20)).toEqual([{ startMin: 540, endMin: 1200 }]);
  });

  it('spans the shop from the earliest to the latest therapist', () => {
    expect(shopOpenRange(hours, ['mali', 'noi', 'off'], friday)).toEqual({ startMin: 600, endMin: 1200 });
  });
});

describe('column contents', () => {
  it('shows a couple booking in both therapists’ columns', () => {
    const pair = booking({ is_pair_booking: true, partner_specialist_id: 'noi' });
    expect(columnBookings([pair], friday, ['noi'], ['mali', 'noi'])).toHaveLength(1);
    expect(columnBookings([pair], friday, ['mali'], ['mali', 'noi'])).toHaveLength(1);
  });

  it('uses the stored duration for the card height', () => {
    expect(bookingRange(booking({}))).toEqual({ startMin: 660, endMin: 750 });
  });

  it('shows shop closures everywhere and own blocks only in the own column', () => {
    const at = (h: number) => new Date(2026, 9, 16, h).toISOString();
    const blocks = [
      { id: 'shop', specialist_id: null, start_time: at(9), end_time: at(10), reason: null, color: null },
      { id: 'own', specialist_id: 'noi', start_time: at(13), end_time: at(14), reason: 'Pause', color: null },
    ];
    expect(columnBlocks(blocks, friday, ['mali']).map((b) => b.block.id)).toEqual(['shop']);
    expect(columnBlocks(blocks, friday, ['noi']).map((b) => b.block.id)).toEqual(['shop', 'own']);
    expect(columnBlocks(blocks, friday, null).map((b) => b.block.id)).toEqual(['shop']);
  });

  it('shows reservations in the combined week column, but not a therapist\'s break', () => {
    const at = (h: number) => new Date(2026, 9, 16, h).toISOString();
    const blocks = [
      { id: 'pause', specialist_id: 'noi', start_time: at(12), end_time: at(13), reason: 'Pause', color: null },
      { id: 'coloured', specialist_id: 'noi', start_time: at(13), end_time: at(14), reason: 'Hr. Schneider', color: '#A855F7' },
      { id: 'phone', specialist_id: 'mali', start_time: at(15), end_time: at(16), reason: '017670339870 Fr. Kimmerly', color: null },
    ];
    expect(columnBlocks(blocks, friday, null).map((b) => b.block.id)).toEqual(['coloured', 'phone']);
  });

  it('keeps inactive therapists visible while they still have appointments', () => {
    const staff = [
      { id: 'mali', name: 'Mali', is_active: true },
      { id: 'old', name: 'Old', is_active: false },
      { id: 'gone', name: 'Gone', is_active: false },
    ];
    const ids = visibleStaff(staff, [booking({ specialist_id: 'old' })], null).map((s) => s.id);
    expect(ids).toEqual(['mali', 'old']);
    expect(visibleStaff(staff, [], 'mali').map((s) => s.id)).toEqual(['mali']);
  });
});

describe('draftFromBlock', () => {
  it('recognises a multi-day holiday as whole days', () => {
    const draft = draftFromBlock({
      id: 'x', specialist_id: null, reason: 'Urlaub', color: null,
      start_time: new Date(2026, 9, 19).toISOString(), end_time: new Date(2026, 9, 24).toISOString(),
    });
    expect(draft).toMatchObject({ owner: 'shop', date: '2026-10-19', lastDay: '2026-10-23', isWholeDay: true });
  });

  it('keeps the clock times of a short block', () => {
    const draft = draftFromBlock({
      id: 'y', specialist_id: 'mali', reason: null, color: null,
      start_time: new Date(2026, 9, 16, 13).toISOString(), end_time: new Date(2026, 9, 16, 14, 30).toISOString(),
    });
    expect(draft).toMatchObject({ owner: 'mali', start: '13:00', end: '14:30', isWholeDay: false });
  });
});

describe('phoneFromText', () => {
  it('finds the phone number in a reservation comment', () => {
    expect(phoneFromText('Fr. Astred 017681277816 Gs Satuuu')).toBe('017681277816');
    expect(phoneFromText('Fr. Kopelke Bei Nann\nrücken nacken\n0157 7180 7377')).toBe('015771807377');
    expect(phoneFromText('+49 40 123456')).toBe('+4940123456');
  });

  it('ignores short numbers and empty comments', () => {
    expect(phoneFromText('Pause 30 min')).toBe('');
    expect(phoneFromText(null)).toBe('');
  });
});
