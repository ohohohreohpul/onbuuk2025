import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CalendarClock } from 'lucide-react';
import { adminAuth } from '../../lib/adminAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { useAdminText } from '../../lib/adminLanguage';
import { toLocalDateString } from '../../lib/localDateTime';
import CreateBookingModal from './CreateBookingModal';
import GiftCardStation from './GiftCardStation';
import BookingTaskModal from './bookings/BookingTaskModal';
import RescheduleModal from './bookings/RescheduleModal';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from './adminUi';
import { CALENDAR_TEXT } from './calendar/calendarText';
import { addDays, fromMinutes, startOfWeek, weekDates } from './calendar/calendarModel';
import { useCalendarData, CalendarBlock, CalendarBooking } from './calendar/useCalendarData';
import CalendarToolbar, { CalendarMode } from './calendar/CalendarToolbar';
import CalendarModal from './calendar/CalendarModal';
import DayGrid from './calendar/DayGrid';
import WeekGrid from './calendar/WeekGrid';
import MonthGrid from './calendar/MonthGrid';
import SlotActionModal from './calendar/SlotActionModal';
import BlockTimeModal from './calendar/BlockTimeModal';
import { BlockDraft, draftFromBlock, phoneFromText } from './calendar/blockDraft';

const DEFAULT_BLOCK_MINUTES = 60;
const NARROW_SCREEN_PX = 640;

interface Slot { day: Date; minutes: number; specialistId: string | null }
interface CreateDraft {
  date: string;
  time?: string;
  specialistId?: string;
  note?: string;
  customerQuery?: string;
  reserved?: { date: string; time: string; specialistId: string };
}
interface BlockState { draft: BlockDraft; existing: CalendarBlock | null }

function rangeFor(mode: CalendarMode, anchor: Date): { from: Date; to: Date } {
  if (mode === 'day') return { from: anchor, to: anchor };
  if (mode === 'week') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) };
  return { from: new Date(anchor.getFullYear(), anchor.getMonth(), 1), to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) };
}

function stepAnchor(mode: CalendarMode, anchor: Date, direction: -1 | 1): Date {
  if (mode === 'day') return addDays(anchor, direction);
  if (mode === 'week') return addDays(anchor, direction * 7);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

interface CalendarViewProps {
  onNavigate?: (view: string) => void;
}

/** The calendar workspace: see the day, book, block, redeem – without leaving this page. */
export default function CalendarView({ onNavigate }: CalendarViewProps) {
  const { t, locale } = useAdminText(CALENDAR_TEXT);
  const adminUser = adminAuth.getCurrentUser();
  const businessId = adminUser?.business_id ?? null;
  const { hasAnyPermission } = usePermissions(adminUser?.id || null);
  const [mode, setMode] = useState<CalendarMode>('day');
  const [anchor, setAnchor] = useState(() => new Date());
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const { from, to } = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const { data, isLoading, hasError, reload } = useCalendarData(businessId, from, to);

  const [slot, setSlot] = useState<Slot | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [blockState, setBlockState] = useState<BlockState | null>(null);
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [movingBooking, setMovingBooking] = useState<CalendarBooking | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [convertingBlock, setConvertingBlock] = useState<CalendarBlock | null>(null);

  const staffName = (id: string | null) => data.staff.find((s) => s.id === id)?.name ?? null;
  const openBooking = data.bookings.find((b) => b.id === openBookingId) ?? null;

  const isNarrow = typeof window !== 'undefined' && window.innerWidth < NARROW_SCREEN_PX;
  const title = mode === 'day'
    ? anchor.toLocaleDateString(locale, isNarrow
      ? { weekday: 'short', day: 'numeric', month: 'short' }
      : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : mode === 'week'
      ? `${weekDates(anchor)[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${weekDates(anchor)[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const openDay = (day: Date) => { setAnchor(day); setMode('day'); };

  const blockDraftFor = (day: Date, minutes: number, owner: string | null): BlockDraft => ({
    owner,
    date: toLocalDateString(day),
    start: fromMinutes(minutes),
    end: fromMinutes(minutes + DEFAULT_BLOCK_MINUTES),
  });

  const afterChange = () => { reload(); };

  /** Opens the appointment form for a reservation; the block is removed only once the appointment is saved. */
  const convertBlock = (block: CalendarBlock) => {
    if (!block.specialist_id) return;
    setBlockState(null);
    setActionError(null);
    const draft = draftFromBlock(block);
    setConvertingBlock(block);
    setCreateDraft({
      date: draft.date,
      time: draft.start,
      specialistId: block.specialist_id,
      note: block.reason ?? undefined,
      customerQuery: phoneFromText(block.reason) || undefined,
      reserved: { date: draft.date, time: draft.start, specialistId: block.specialist_id },
    });
  };

  const afterCreate = async () => {
    const block = convertingBlock;
    setConvertingBlock(null);
    if (block) {
      const { error } = await supabase.from('time_blocks').delete().eq('id', block.id);
      if (error) {
        console.error('Appointment saved, reservation not removed:', error);
        setActionError(t.errorRemoveReservation);
      }
    }
    reload();
  };

  return (
    <div className="space-y-4">
      <CalendarToolbar
        title={title}
        mode={mode}
        staff={data.staff}
        staffFilter={staffFilter}
        canSellVouchers={Boolean(onNavigate) && hasAnyPermission(['process_payments', 'view_gift_cards'])}
        t={t}
        onMode={setMode}
        onStep={(direction) => setAnchor((current) => stepAnchor(mode, current, direction))}
        onToday={() => setAnchor(new Date())}
        onStaffFilter={setStaffFilter}
        onNewBooking={() => setCreateDraft({ date: toLocalDateString(mode === 'month' ? new Date() : anchor), specialistId: staffFilter ?? undefined })}
        onBlockTime={() => setBlockState({ draft: blockDraftFor(mode === 'month' ? new Date() : anchor, 12 * 60, staffFilter), existing: null })}
        onRedeemVoucher={() => setIsRedeeming(true)}
        onSellVoucher={() => onNavigate?.('loyalty')}
      />

      {actionError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p>}

      <div className={`${ADMIN_SURFACE} overflow-hidden`}>
        {hasError ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <CalendarClock className="h-8 w-8 text-stone-400" />
            <p className="text-sm text-stone-600">{t.loadFailed}</p>
            <button type="button" onClick={reload} className={ADMIN_SECONDARY_BUTTON}>{t.retry}</button>
          </div>
        ) : isLoading && data.staff.length === 0 ? (
          <div className="flex justify-center p-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" /></div>
        ) : (
          <div className="max-h-[calc(100vh-260px)] min-h-[420px] overflow-y-auto">
            {mode === 'day' && (
              <DayGrid day={anchor} data={data} staffFilter={staffFilter} t={t}
                onSlot={(day, minutes, specialistId) => setSlot({ day, minutes, specialistId })}
                onBooking={(b) => setOpenBookingId(b.id)}
                onBlock={(block) => setBlockState({ draft: blockDraftFor(anchor, 0, null), existing: block })}
              />
            )}
            {mode === 'week' && (
              <WeekGrid anchor={anchor} data={data} staffFilter={staffFilter} t={t} locale={locale}
                onSlot={(day, minutes, specialistId) => setSlot({ day, minutes, specialistId })}
                onBooking={(b) => setOpenBookingId(b.id)}
                onBlock={(block) => setBlockState({ draft: blockDraftFor(anchor, 0, null), existing: block })}
                onOpenDay={openDay}
              />
            )}
            {mode === 'month' && (
              <MonthGrid anchor={anchor} data={data} staffFilter={staffFilter} t={t} locale={locale} onOpenDay={openDay} />
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-stone-500">{t.hint}</p>

      {slot && (
        <SlotActionModal
          dateLabel={slot.day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          time={fromMinutes(slot.minutes)}
          staffName={staffName(slot.specialistId)}
          t={t}
          onClose={() => setSlot(null)}
          onBook={() => {
            setCreateDraft({ date: toLocalDateString(slot.day), time: fromMinutes(slot.minutes), specialistId: slot.specialistId ?? undefined });
            setSlot(null);
          }}
          onBlock={() => {
            setBlockState({ draft: blockDraftFor(slot.day, slot.minutes, slot.specialistId), existing: null });
            setSlot(null);
          }}
        />
      )}

      {createDraft && (
        <CreateBookingModal
          isOpen
          preselectedDate={createDraft.date}
          preselectedTime={createDraft.time}
          preselectedSpecialistId={createDraft.specialistId}
          preselectedNote={createDraft.note}
          customerQuery={createDraft.customerQuery}
          reserved={createDraft.reserved}
          onClose={() => { setCreateDraft(null); setConvertingBlock(null); }}
          onSuccess={afterCreate}
        />
      )}

      {blockState && businessId && (
        <BlockTimeModal
          businessId={businessId}
          staff={data.staff}
          draft={blockState.draft}
          existing={blockState.existing}
          t={t}
          onClose={() => setBlockState(null)}
          onSaved={() => { setBlockState(null); afterChange(); }}
          onConvert={convertBlock}
        />
      )}

      {openBookingId && (
        <BookingTaskModal
          bookingId={openBookingId}
          onClose={() => setOpenBookingId(null)}
          onChanged={afterChange}
          moreActions={openBooking && (
            <button type="button" onClick={() => { setMovingBooking(openBooking); setOpenBookingId(null); }} className={ADMIN_SECONDARY_BUTTON}>
              <CalendarClock className="h-4 w-4" />{t.move}
            </button>
          )}
        />
      )}

      {movingBooking && (
        <RescheduleModal
          booking={movingBooking}
          onClose={() => setMovingBooking(null)}
          onMoved={() => { setMovingBooking(null); afterChange(); }}
        />
      )}

      {isRedeeming && businessId && (
        <CalendarModal title={t.voucherTitle} closeLabel={t.close} onClose={() => setIsRedeeming(false)} maxWidthClass="max-w-xl">
          <GiftCardStation
            businessId={businessId}
            onNavigate={(view) => { setIsRedeeming(false); onNavigate?.(view); }}
          />
        </CalendarModal>
      )}
    </div>
  );
}
