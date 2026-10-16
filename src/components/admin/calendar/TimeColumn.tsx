import { useEffect, useState } from 'react';
import { Ban, Check, StickyNote, Users } from 'lucide-react';
import {
  MINUTES_PER_HOUR, MinuteRange, Placed, SLOT_STEP_MINUTES, StaffColor, blockStripes, fromMinutes, snapMinutes,
} from './calendarModel';
import type { CalendarBlock, CalendarBooking } from './useCalendarData';
import type { CalendarText } from './calendarText';

export const HOUR_HEIGHT_PX = 72;
const MIN_CARD_HEIGHT_PX = 26;
const NOW_TICK_MS = 60_000;

export interface ColumnBooking extends MinuteRange {
  booking: CalendarBooking;
  color: StaffColor;
  /** Internal team note, shown on the card. */
  note?: string;
}

export interface ColumnBlock extends MinuteRange {
  block: CalendarBlock;
  isShopClosure: boolean;
}

interface TimeColumnProps {
  startHour: number;
  endHour: number;
  /** Grey: outside working hours. */
  offRanges: MinuteRange[];
  blocks: ColumnBlock[];
  bookings: Placed<ColumnBooking>[];
  isToday: boolean;
  t: CalendarText;
  label: string;
  onEmptyClick: (minutes: number) => void;
  onBookingClick: (booking: CalendarBooking) => void;
  onBlockClick: (block: CalendarBlock) => void;
}

const toPx = (minutes: number, startHour: number) =>
  ((minutes - startHour * MINUTES_PER_HOUR) * HOUR_HEIGHT_PX) / MINUTES_PER_HOUR;

function useNowMinutes(isActive: boolean): number {
  const read = () => { const now = new Date(); return now.getHours() * MINUTES_PER_HOUR + now.getMinutes(); };
  const [minutes, setMinutes] = useState(read);
  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setMinutes(read()), NOW_TICK_MS);
    return () => window.clearInterval(timer);
  }, [isActive]);
  return minutes;
}

function BookingCard({ placed, startHour, t, onClick }: {
  placed: Placed<ColumnBooking>; startHour: number; t: CalendarText; onClick: () => void;
}) {
  const { item, lane, laneCount } = placed;
  const { booking, color } = item;
  const isPending = booking.status === 'pending';
  const isNoShow = booking.no_show === true || booking.status === 'no_show';
  const isPaid = booking.payment_status === 'completed' || booking.payment_status === 'paid';
  const height = Math.max(MIN_CARD_HEIGHT_PX, toPx(item.endMin, startHour) - toPx(item.startMin, startHour) - 2);
  const service = booking.services?.name ?? '';

  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={`group absolute z-10 overflow-hidden rounded-xl px-2.5 py-1.5 text-left shadow-[0_1px_3px_rgba(26,23,20,0.08)] ring-1 ring-inset transition duration-150 hover:z-20 hover:shadow-[0_6px_18px_rgba(26,23,20,0.14)] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 motion-safe:hover:-translate-y-px ${isNoShow ? 'opacity-50' : ''}`}
      style={{
        top: toPx(item.startMin, startHour) + 1,
        height,
        left: `calc(${(lane / laneCount) * 100}% + 3px)`,
        width: `calc(${100 / laneCount}% - 6px)`,
        background: isPending ? '#FFFBEB' : `linear-gradient(180deg, #FFFFFF 0%, ${color.bg} 100%)`,
        ['--tw-ring-color' as string]: isPending ? '#FCD34D' : `${color.border}66`,
        outline: isPending ? '1px dashed #F59E0B' : undefined,
        outlineOffset: isPending ? '-3px' : undefined,
        color: color.text,
      }}
    >
      <div className="flex items-center gap-1.5 text-[12px] font-semibold leading-tight">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: isPending ? '#F59E0B' : color.border }} aria-hidden />
        <span className="tabular-nums">{fromMinutes(item.startMin)}</span>
        <span className={`truncate ${isNoShow ? 'line-through' : ''}`}>{booking.customer_name}</span>
        {isPaid && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label={t.paid} />}
      </div>
      {height > 40 && <div className="truncate text-[12px] leading-tight opacity-80">{service}</div>}
      {height > 58 && item.note && (
        <div className="mt-0.5 flex items-start gap-1 text-[11px] italic leading-tight opacity-90">
          <StickyNote className="mt-px h-3 w-3 shrink-0" aria-hidden /><span className="line-clamp-2">{item.note}</span>
        </div>
      )}
      {height > 58 && (
        <div className="mt-0.5 flex flex-wrap gap-1 text-[11px] font-medium">
          {isPending && <span className="rounded bg-amber-100 px-1 text-amber-800">{t.waitingConfirm}</span>}
          {isNoShow && <span className="rounded bg-stone-200 px-1 text-stone-700">{t.noShow}</span>}
          {booking.is_pair_booking && <span className="inline-flex items-center gap-0.5 rounded bg-white/70 px-1"><Users className="h-3 w-3" />{t.people}</span>}
        </div>
      )}
    </button>
  );
}

/** One vertical time track (a therapist in day view, a day in week view). */
export default function TimeColumn(props: TimeColumnProps) {
  const { startHour, endHour, t } = props;
  const nowMinutes = useNowMinutes(props.isToday);
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT_PX;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const [hoverMin, setHoverMin] = useState<number | null>(null);
  const minutesAt = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = startHour * MINUTES_PER_HOUR + ((event.clientY - rect.top) / HOUR_HEIGHT_PX) * MINUTES_PER_HOUR;
    return Math.min(snapMinutes(minutes), endHour * MINUTES_PER_HOUR - SLOT_STEP_MINUTES);
  };
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => props.onEmptyClick(minutesAt(event));
  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    // Over an appointment or a block the card itself reacts; no ghost slot.
    if ((event.target as HTMLElement).closest('button')) {
      if (hoverMin !== null) setHoverMin(null);
      return;
    }
    const minutes = minutesAt(event);
    if (minutes !== hoverMin) setHoverMin(minutes);
  };

  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={props.label}
      onClick={handleClick}
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverMin(null)}
      className="group/col relative cursor-pointer border-l border-stone-200/80 bg-white/60 transition-colors duration-150 hover:bg-white/90"
      style={{ height: totalHeight }}
    >
      {hours.map((hour) => (
        <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-stone-200/70" style={{ top: (hour - startHour) * HOUR_HEIGHT_PX }}>
          <div className="absolute inset-x-0 border-t border-dashed border-stone-100" style={{ top: HOUR_HEIGHT_PX / 2 }} />
        </div>
      ))}

      {hoverMin !== null && (
        <div
          className="pointer-events-none absolute inset-x-[3px] z-[5] flex items-start rounded-xl bg-stone-900/[0.045] px-2.5 py-1 text-[12px] font-semibold text-stone-600 ring-1 ring-inset ring-stone-900/15 motion-safe:transition-[top] motion-safe:duration-100"
          style={{ top: toPx(hoverMin, startHour) + 1, height: HOUR_HEIGHT_PX / 2 - 2 }}
          aria-hidden
        >
          + {fromMinutes(hoverMin)}
        </div>
      )}

      {props.offRanges.map((range, i) => (
        <div
          key={`off-${i}`}
          className="pointer-events-none absolute inset-x-0 bg-stone-200/45"
          style={{ top: toPx(range.startMin, startHour), height: toPx(range.endMin, startHour) - toPx(range.startMin, startHour) }}
        />
      ))}

      {props.blocks.map(({ block, isShopClosure, startMin, endMin }) => (
        <button
          key={block.id}
          type="button"
          onClick={(event) => { event.stopPropagation(); props.onBlockClick(block); }}
              className="absolute inset-x-[3px] z-10 overflow-hidden rounded-xl px-2.5 py-1.5 text-left text-[12px] leading-snug text-stone-800 ring-1 ring-inset ring-stone-900/10 transition duration-150 hover:shadow-[0_6px_18px_rgba(26,23,20,0.12)] motion-safe:hover:-translate-y-px"
          style={{
            top: Math.max(0, toPx(startMin, startHour)) + 1,
            height: Math.max(MIN_CARD_HEIGHT_PX, toPx(endMin, startHour) - Math.max(0, toPx(startMin, startHour)) - 2),
            background: blockStripes(block.color).background,
          }}
        >
          <span className="flex items-center gap-1 font-semibold tabular-nums">
            {fromMinutes(startMin)}–{fromMinutes(endMin)}
            <Ban className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </span>
          <span className="block font-medium">{isShopClosure ? t.shopClosed : t.blocked}</span>
          {block.reason && <span className="block whitespace-pre-line italic text-stone-700">{block.reason}</span>}
        </button>
      ))}

      {props.bookings.map((placed) => (
        <BookingCard
          key={placed.item.booking.id + placed.item.startMin}
          placed={placed}
          startHour={startHour}
          t={t}
          onClick={() => props.onBookingClick(placed.item.booking)}
        />
      ))}

      {props.isToday && nowMinutes >= startHour * MINUTES_PER_HOUR && nowMinutes <= endHour * MINUTES_PER_HOUR && (
        <div className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-red-500" style={{ top: toPx(nowMinutes, startHour) }}>
          <div className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}

/** Hour labels at the left edge. */
export function HourGutter({ startHour, endHour }: { startHour: number; endHour: number }) {
  return (
    <div className="relative w-14 shrink-0" style={{ height: (endHour - startHour) * HOUR_HEIGHT_PX }}>
      {Array.from({ length: endHour - startHour }, (_, i) => (
        <div key={i} className={`absolute right-2 text-[12px] tabular-nums text-stone-400 ${i === 0 ? 'translate-y-0.5' : '-translate-y-1/2'}`} style={{ top: i * HOUR_HEIGHT_PX }}>
          {`${String(startHour + i).padStart(2, '0')}:00`}
        </div>
      ))}
    </div>
  );
}
