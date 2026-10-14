import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminAuth } from '../../lib/adminAuth';
import { executeWithTimeout } from '../../lib/queryUtils';
import { AlertCircle, CalendarX2, UserX, Banknote, Repeat2, ArrowRight, Sparkles, Clock3, Undo2, Loader2 } from 'lucide-react';
import { useCurrency } from '../../lib/currencyContext';
import { createUnpaidNoShowFees, type UnbilledNoShow } from '../../lib/noShowFees';
import { REGULAR_MIN_VISITS, fetchCustomerStatsForBusiness } from '../../lib/customerStats';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

type ActionId = 'refill' | 'unpaid-fees' | 'unbilled-no-shows' | 'no-shows' | 'pending' | 'lapsed' | 'first-timers';

interface ActionItem {
  id: ActionId;
  count: number;
  amount: number;
  targetView: string;
  tint: 'amber' | 'stone' | 'red' | 'ink';
  signature: string;
  recoverableValue: number;
  unbilledNoShows?: UnbilledNoShow[];
}

type ActionText = {
  refillOne: string; refillMany: string; refillDetailOne: string; refillDetailMany: string; refillAction: string;
  unpaidOne: string; unpaidMany: string; unpaidDetail: string; unpaidAction: string;
  unbilledOne: string; unbilledMany: string; unbilledDetail: string; unbilledAction: string;
  noPolicyOne: string; noPolicyMany: string; noPolicyDetail: string; noPolicyAction: string;
  pendingOne: string; pendingMany: string; pendingDetail: string; pendingAction: string;
  lapsedOne: string; lapsedMany: string; lapsedDetail: string;
  firstOne: string; firstMany: string; firstDetail: string; viewCustomers: string;
  allClear: string; allClearDetail: string; lastHidden: string; hidden: string; undo: string;
  title: string; itemOne: string; itemMany: string; recoverable: string; attention: string; hint: string;
  later: string; hideLabel: string; billingError: string;
};

const TEXT: Translations<ActionText> = {
  en: {
    refillOne: '{count} upcoming slot freed by cancellation',
    refillMany: '{count} upcoming slots freed by cancellation',
    refillDetailOne: "Worth {amount}. Offer it to a regular or your waitlist, then use Later once you've reached out.",
    refillDetailMany: "Worth {amount}. Offer them to a regular or your waitlist, then use Later once you've reached out.",
    refillAction: 'Open bookings',
    unpaidOne: '{count} no-show fee unpaid', unpaidMany: '{count} no-show fees unpaid',
    unpaidDetail: '{amount} outstanding. Charge the saved card, record another payment, or waive the fee.',
    unpaidAction: 'Resolve fee',
    unbilledOne: '{count} no-show was never billed', unbilledMany: '{count} no-shows were never billed',
    unbilledDetail: '{amount} in fees under your policy. Add them to No-Show Fees, then charge, record or waive each one.',
    unbilledAction: 'Add fees',
    noPolicyOne: '{count} no-show on services without a fee', noPolicyMany: '{count} no-shows on services without a fee',
    noPolicyDetail: 'Set a no-show fee on these services so the next missed appointment is covered.',
    noPolicyAction: 'Set a fee',
    pendingOne: '{count} upcoming booking awaiting confirmation', pendingMany: '{count} upcoming bookings awaiting confirmation',
    pendingDetail: "Confirm them so customers don't wonder whether they're booked.",
    pendingAction: 'Confirm now',
    lapsedOne: "{count} regular client hasn't been in for 30+ days", lapsedMany: "{count} regular clients haven't been in for 30+ days",
    lapsedDetail: 'They know the service and loved it. A short "we miss you" usually brings them back.',
    firstOne: "{count} first-time client hasn't rebooked", firstMany: "{count} first-time clients haven't rebooked",
    firstDetail: 'The second visit is the hardest to win. A personal follow-up now converts best.',
    viewCustomers: 'View customers',
    allClear: 'All clear',
    allClearDetail: 'Nothing needs your attention right now. Resolved tasks stay closed; snoozed items return tomorrow.',
    lastHidden: 'Last item hidden until tomorrow.', hidden: 'Hidden until tomorrow.', undo: 'Undo',
    title: 'Action Centre', itemOne: '{count} item', itemMany: '{count} items',
    recoverable: 'Up to {amount} recoverable today if you act on these.',
    attention: 'What needs your attention today.',
    hint: 'Resolve the underlying task, or use Later to hide it until tomorrow.',
    later: 'Later', hideLabel: 'Hide "{title}" until tomorrow',
    billingError: 'We could not add these fees. Please try again.',
  },
  de: {
    refillOne: '{count} kommender Termin durch Stornierung frei', refillMany: '{count} kommende Termine durch Stornierung frei',
    refillDetailOne: 'Wert: {amount}. Stammkunden oder der Warteliste anbieten und nach der Kontaktaufnahme „Später“ wählen.',
    refillDetailMany: 'Wert: {amount}. Stammkunden oder der Warteliste anbieten und nach der Kontaktaufnahme „Später“ wählen.',
    refillAction: 'Buchungen öffnen',
    unpaidOne: '{count} No-Show-Gebühr unbezahlt', unpaidMany: '{count} No-Show-Gebühren unbezahlt',
    unpaidDetail: '{amount} offen. Gespeicherte Karte belasten, andere Zahlung erfassen oder Gebühr erlassen.',
    unpaidAction: 'Gebühr klären',
    unbilledOne: '{count} No-Show wurde nie berechnet', unbilledMany: '{count} No-Shows wurden nie berechnet',
    unbilledDetail: '{amount} an Gebühren laut Richtlinie. Unter No-Show-Gebühren hinzufügen, dann jeweils belasten, erfassen oder erlassen.',
    unbilledAction: 'Gebühren hinzufügen',
    noPolicyOne: '{count} No-Show bei Leistungen ohne Gebühr', noPolicyMany: '{count} No-Shows bei Leistungen ohne Gebühr',
    noPolicyDetail: 'Für diese Leistungen eine No-Show-Gebühr festlegen, damit der nächste verpasste Termin abgedeckt ist.',
    noPolicyAction: 'Gebühr festlegen',
    pendingOne: '{count} kommende Buchung wartet auf Bestätigung', pendingMany: '{count} kommende Buchungen warten auf Bestätigung',
    pendingDetail: 'Jetzt bestätigen, damit Kunden sicher wissen, dass ihr Termin steht.',
    pendingAction: 'Jetzt bestätigen',
    lapsedOne: '{count} Stammkunde seit über 30 Tagen nicht da', lapsedMany: '{count} Stammkunden seit über 30 Tagen nicht da',
    lapsedDetail: 'Sie kennen und schätzen die Leistung. Ein kurzes „Wir vermissen Sie“ bringt sie meist zurück.',
    firstOne: '{count} Erstkunde hat nicht wieder gebucht', firstMany: '{count} Erstkunden haben nicht wieder gebucht',
    firstDetail: 'Der zweite Besuch ist am schwersten zu gewinnen. Eine persönliche Nachricht wirkt jetzt am besten.',
    viewCustomers: 'Kunden anzeigen',
    allClear: 'Alles erledigt',
    allClearDetail: 'Gerade gibt es nichts zu tun. Erledigte Aufgaben bleiben geschlossen, verschobene kommen morgen wieder.',
    lastHidden: 'Letzte Aufgabe bis morgen ausgeblendet.', hidden: 'Bis morgen ausgeblendet.', undo: 'Rückgängig',
    title: 'Aufgaben', itemOne: '{count} Aufgabe', itemMany: '{count} Aufgaben',
    recoverable: 'Bis zu {amount} heute zurückzugewinnen, wenn diese Aufgaben erledigt werden.',
    attention: 'Was heute Aufmerksamkeit braucht.',
    hint: 'Die eigentliche Aufgabe erledigen oder mit „Später“ bis morgen ausblenden.',
    later: 'Später', hideLabel: '„{title}“ bis morgen ausblenden',
    billingError: 'Die Gebühren konnten nicht hinzugefügt werden. Bitte erneut versuchen.',
  },
  th: {
    refillOne: 'มีคิวว่าง {count} คิวจากการยกเลิก', refillMany: 'มีคิวว่าง {count} คิวจากการยกเลิก',
    refillDetailOne: 'มูลค่า {amount} เสนอให้ลูกค้าประจำหรือรายชื่อรอคิว แล้วกด "ภายหลัง" เมื่อติดต่อแล้ว',
    refillDetailMany: 'มูลค่า {amount} เสนอให้ลูกค้าประจำหรือรายชื่อรอคิว แล้วกด "ภายหลัง" เมื่อติดต่อแล้ว',
    refillAction: 'เปิดการจอง',
    unpaidOne: 'ค่าธรรมเนียมไม่มาตามนัดค้างชำระ {count} รายการ', unpaidMany: 'ค่าธรรมเนียมไม่มาตามนัดค้างชำระ {count} รายการ',
    unpaidDetail: 'ค้างอยู่ {amount} เรียกเก็บจากบัตรที่บันทึกไว้ บันทึกการชำระแบบอื่น หรือยกเว้นค่าธรรมเนียม',
    unpaidAction: 'จัดการค่าธรรมเนียม',
    unbilledOne: 'ไม่มาตามนัด {count} รายการยังไม่ได้เรียกเก็บ', unbilledMany: 'ไม่มาตามนัด {count} รายการยังไม่ได้เรียกเก็บ',
    unbilledDetail: 'ค่าธรรมเนียม {amount} ตามนโยบายของร้าน เพิ่มไปที่ค่าธรรมเนียมไม่มาตามนัด แล้วเรียกเก็บ บันทึก หรือยกเว้นทีละรายการ',
    unbilledAction: 'เพิ่มค่าธรรมเนียม',
    noPolicyOne: 'ไม่มาตามนัด {count} รายการในบริการที่ไม่มีค่าธรรมเนียม', noPolicyMany: 'ไม่มาตามนัด {count} รายการในบริการที่ไม่มีค่าธรรมเนียม',
    noPolicyDetail: 'ตั้งค่าธรรมเนียมไม่มาตามนัดให้บริการเหล่านี้ เพื่อให้นัดหมายที่พลาดครั้งต่อไปได้รับการชดเชย',
    noPolicyAction: 'ตั้งค่าธรรมเนียม',
    pendingOne: 'การจองที่กำลังจะมาถึง {count} รายการรอยืนยัน', pendingMany: 'การจองที่กำลังจะมาถึง {count} รายการรอยืนยัน',
    pendingDetail: 'ยืนยันการจองเพื่อให้ลูกค้ามั่นใจว่าจองสำเร็จแล้ว',
    pendingAction: 'ยืนยันเลย',
    lapsedOne: 'ลูกค้าประจำ {count} คนไม่ได้มาเกิน 30 วัน', lapsedMany: 'ลูกค้าประจำ {count} คนไม่ได้มาเกิน 30 วัน',
    lapsedDetail: 'พวกเขารู้จักและชอบบริการของร้านอยู่แล้ว ข้อความสั้น ๆ ว่า "คิดถึงนะ" มักทำให้กลับมา',
    firstOne: 'ลูกค้าใหม่ {count} คนยังไม่จองอีก', firstMany: 'ลูกค้าใหม่ {count} คนยังไม่จองอีก',
    firstDetail: 'การมาครั้งที่สองยากที่สุด การติดตามแบบส่วนตัวตอนนี้ได้ผลดีที่สุด',
    viewCustomers: 'ดูลูกค้า',
    allClear: 'ไม่มีงานค้าง',
    allClearDetail: 'ตอนนี้ไม่มีอะไรต้องจัดการ งานที่เสร็จแล้วจะไม่กลับมา ส่วนงานที่เลื่อนไว้จะกลับมาพรุ่งนี้',
    lastHidden: 'ซ่อนงานล่าสุดไว้จนถึงพรุ่งนี้', hidden: 'ซ่อนไว้จนถึงพรุ่งนี้', undo: 'เลิกทำ',
    title: 'ศูนย์งาน', itemOne: '{count} รายการ', itemMany: '{count} รายการ',
    recoverable: 'กู้คืนได้สูงสุด {amount} วันนี้ หากจัดการรายการเหล่านี้',
    attention: 'สิ่งที่ต้องจัดการวันนี้',
    hint: 'จัดการงานให้เสร็จ หรือกด "ภายหลัง" เพื่อซ่อนไว้จนถึงพรุ่งนี้',
    later: 'ภายหลัง', hideLabel: 'ซ่อน "{title}" จนถึงพรุ่งนี้',
    billingError: 'เพิ่มค่าธรรมเนียมไม่สำเร็จ โปรดลองอีกครั้ง',
  },
};

interface ItemText {
  title: string;
  detail: string;
  actionLabel: string;
}

/** Title, detail and button label for an action, in the current admin language. */
function describeItem(item: ActionItem, t: ActionText, formatPrice: (cents: number) => string): ItemText {
  const isOne = item.count === 1;
  const values = { count: item.count, amount: formatPrice(item.amount) };
  const pick = (one: string, many: string) => fillText(isOne ? one : many, values);
  switch (item.id) {
    case 'refill':
      return { title: pick(t.refillOne, t.refillMany), detail: pick(t.refillDetailOne, t.refillDetailMany), actionLabel: t.refillAction };
    case 'unpaid-fees':
      return { title: pick(t.unpaidOne, t.unpaidMany), detail: fillText(t.unpaidDetail, values), actionLabel: t.unpaidAction };
    case 'unbilled-no-shows':
      return { title: pick(t.unbilledOne, t.unbilledMany), detail: fillText(t.unbilledDetail, values), actionLabel: t.unbilledAction };
    case 'no-shows':
      return { title: pick(t.noPolicyOne, t.noPolicyMany), detail: t.noPolicyDetail, actionLabel: t.noPolicyAction };
    case 'pending':
      return { title: pick(t.pendingOne, t.pendingMany), detail: t.pendingDetail, actionLabel: t.pendingAction };
    case 'lapsed':
      return { title: pick(t.lapsedOne, t.lapsedMany), detail: t.lapsedDetail, actionLabel: t.viewCustomers };
    case 'first-timers':
      return { title: pick(t.firstOne, t.firstMany), detail: t.firstDetail, actionLabel: t.viewCustomers };
  }
}

interface ActionCentreProps {
  onNavigate: (view: string) => void;
  refreshKey?: number;
}

interface DurationRelation {
  price_cents: number;
}

interface BookingActionRow {
  id: string;
  service_durations?: DurationRelation | DurationRelation[] | null;
}

interface NoShowActionRow {
  id: string;
  customer_email: string;
  booking_date: string;
  start_time: string;
  service?: { name: string; no_show_fee: number | null } | { name: string; no_show_fee: number | null }[] | null;
  fees?: { id: string } | { id: string }[] | null;
}

const firstOf = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

interface UnpaidFeeRow {
  id: string;
  amount: number | string;
}


interface SnoozeRow {
  action_key: string;
  item_signature: string;
  snoozed_until: string;
}

const TINTS: Record<string, string> = {
  amber: 'bg-amber-50 border-amber-200/80 text-amber-900',
  stone: 'bg-stone-50 border-stone-200/80 text-stone-800',
  red: 'bg-red-50 border-red-200/80 text-red-900',
  ink: 'bg-[#1A1714] border-transparent text-white',
};

const ICON_TINTS: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700',
  stone: 'bg-stone-200/80 text-stone-600',
  red: 'bg-red-100 text-red-600',
  ink: 'bg-white/15 text-white',
};

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const FIRST_TIMER_MIN_DAYS = 7;
const LAPSED_AFTER_DAYS = 30;

const makeSignature = (ids: string[]) => [...ids].sort().join(':');
const durationPrice = (booking: BookingActionRow) => {
  const duration = Array.isArray(booking.service_durations)
    ? booking.service_durations[0]
    : booking.service_durations;
  return Number(duration?.price_cents || 0);
};

export default function ActionCentre({ onNavigate, refreshKey }: ActionCentreProps) {
  const { formatPrice } = useCurrency();
  const { t } = useAdminText(TEXT);
  const adminUser = adminAuth.getCurrentUser();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoveredValue, setRecoveredValue] = useState(0);
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [lastSnoozed, setLastSnoozed] = useState<ActionItem | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    computeActions();
  }, [refreshKey]);

  const computeActions = async () => {
    const businessId = adminUser?.business_id;
    if (!businessId) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const todayIso = toLocalIsoDate(now);
    const daysAgo = (days: number) => {
      const date = new Date(now);
      date.setDate(now.getDate() - days);
      return toLocalIsoDate(date);
    };
    const d7 = daysAgo(FIRST_TIMER_MIN_DAYS);
    const d30 = daysAgo(LAPSED_AFTER_DAYS);

    try {
      const [cancelledRes, noShowRes, unpaidFeesRes, repeatRes, pendingUpRes, snoozesRes] = await Promise.all([
        executeWithTimeout(
          supabase.from('bookings')
            .select('id, booking_date, service_durations(price_cents)')
            .eq('business_id', businessId).eq('status', 'cancelled')
            .eq('no_show', false)
            .gte('booking_date', todayIso),
          { timeout: 8000 }
        ),
        executeWithTimeout(
          supabase.from('bookings')
            .select('id, customer_email, booking_date, start_time, service:services(name, no_show_fee), fees:no_show_fees(id)')
            .eq('business_id', businessId).eq('no_show', true)
            .gte('booking_date', d30),
          { timeout: 8000 }
        ),
        executeWithTimeout(
          supabase.from('no_show_fees')
            .select('id, amount, booking:bookings!inner(business_id)')
            .eq('booking.business_id', businessId).eq('resolution_status', 'unpaid'),
          { timeout: 8000 }
        ),
        // Customer nudges are optional; the other actions still show if stats fail (error is logged).
        fetchCustomerStatsForBusiness(businessId).catch(() => new Map()),
        executeWithTimeout(
          supabase.from('bookings')
            .select('id')
            .eq('business_id', businessId).eq('status', 'pending')
            .gte('booking_date', todayIso),
          { timeout: 8000 }
        ),
        executeWithTimeout(
          supabase.from('action_centre_snoozes')
            .select('action_key, item_signature, snoozed_until')
            .eq('business_id', businessId),
          { timeout: 8000 }
        ),
      ]);

      const actions: ActionItem[] = [];

      // 1. Cancellations that could be refilled
      const cancellations = (cancelledRes.data || []) as unknown as BookingActionRow[];
      if (cancellations.length > 0) {
        const est = cancellations.reduce((sum, booking) => sum + durationPrice(booking), 0);
        actions.push({
          id: 'refill',
          count: cancellations.length,
          amount: est,
          targetView: 'bookings',
          tint: 'ink',
          signature: makeSignature(cancellations.map((booking) => booking.id)),
          recoverableValue: est,
        });
      }

      // 2. Unpaid no-show fees
      const unpaid = (unpaidFeesRes.data || []) as unknown as UnpaidFeeRow[];
      if (unpaid.length > 0) {
        const owed = unpaid.reduce((sum, f) => sum + Math.round(Number(f.amount) || 0), 0);
        actions.push({
          id: 'unpaid-fees',
          count: unpaid.length,
          amount: owed,
          targetView: 'fees',
          tint: 'red',
          signature: makeSignature(unpaid.map((fee) => fee.id)),
          recoverableValue: owed,
        });
      }

      // 3. No-shows in the last month: bill the ones that were never billed,
      //    and flag the ones whose service has no fee policy at all.
      const noShows = (noShowRes.data || []) as unknown as NoShowActionRow[];
      const unbilled: UnbilledNoShow[] = noShows
        .filter((booking) => !firstOf(booking.fees) && Number(firstOf(booking.service)?.no_show_fee || 0) > 0)
        .map((booking) => ({
          id: booking.id,
          customer_email: booking.customer_email,
          booking_date: booking.booking_date,
          start_time: booking.start_time,
          serviceName: firstOf(booking.service)?.name || 'appointment',
          feeCents: Number(firstOf(booking.service)?.no_show_fee || 0),
        }));
      if (unbilled.length > 0) {
        const owedUnbilled = unbilled.reduce((sum, booking) => sum + booking.feeCents, 0);
        actions.push({
          id: 'unbilled-no-shows',
          count: unbilled.length,
          amount: owedUnbilled,
          targetView: 'fees',
          tint: 'amber',
          signature: makeSignature(unbilled.map((booking) => booking.id)),
          recoverableValue: owedUnbilled,
          unbilledNoShows: unbilled,
        });
      }

      const withoutPolicy = noShows.filter((booking) => Number(firstOf(booking.service)?.no_show_fee || 0) <= 0);
      if (withoutPolicy.length > 0) {
        actions.push({
          id: 'no-shows',
          count: withoutPolicy.length,
          amount: 0,
          targetView: 'services',
          tint: 'stone',
          signature: makeSignature(withoutPolicy.map((booking) => booking.id)),
          recoverableValue: 0,
        });
      }

      // 4. Pending upcoming bookings needing confirmation
      const pendingUp = (pendingUpRes.data || []) as unknown as BookingActionRow[];
      if (pendingUp.length > 0) {
        actions.push({
          id: 'pending',
          count: pendingUp.length,
          amount: 0,
          targetView: 'bookings',
          tint: 'amber',
          signature: makeSignature(pendingUp.map((booking) => booking.id)),
          recoverableValue: 0,
        });
      }

      // 5. Lapsed regulars: 2+ real visits, none in 30+ days, nothing booked.
      const customerStats = [...repeatRes.values()];
      const lapsedRegulars = customerStats.filter(
        (c) => c.visits_count >= REGULAR_MIN_VISITS && c.upcoming_count === 0 && !!c.last_visit_date && c.last_visit_date < d30
      );
      if (lapsedRegulars.length > 0) {
        actions.push({
          id: 'lapsed',
          count: lapsedRegulars.length,
          amount: 0,
          targetView: 'customers',
          tint: 'stone',
          signature: makeSignature(lapsedRegulars.map((customer) => customer.customer_id)),
          recoverableValue: 0,
        });
      }

      // 6. First-timers: exactly one visit 7–30 days ago and nothing booked since.
      const firstTimers = customerStats.filter(
        (c) => c.visits_count === 1 && c.upcoming_count === 0 && !!c.last_visit_date && c.last_visit_date >= d30 && c.last_visit_date <= d7
      );
      if (firstTimers.length > 0) {
        actions.push({
          id: 'first-timers',
          count: firstTimers.length,
          amount: 0,
          targetView: 'customers',
          tint: 'stone',
          signature: makeSignature(firstTimers.map((customer) => customer.customer_id)),
          recoverableValue: 0,
        });
      }

      const snoozes = (snoozesRes.data || []) as unknown as SnoozeRow[];
      const visibleActions = actions.filter((action) => {
        const snooze = snoozes.find((row) => row.action_key === action.id);
        if (!snooze || snooze.item_signature !== action.signature) return true;
        return new Date(snooze.snoozed_until) <= now;
      });

      setRecoveredValue(visibleActions.reduce((sum, action) => sum + action.recoverableValue, 0));
      setItems(visibleActions);
    } catch (err) {
      console.error('Action Centre error:', err);
    } finally {
      setLoading(false);
    }
  };

  const snoozeUntilTomorrow = async (item: ActionItem) => {
    const businessId = adminUser?.business_id;
    if (!businessId) return;

    setSnoozingId(item.id);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from('action_centre_snoozes').upsert({
      business_id: businessId,
      action_key: item.id,
      item_signature: item.signature,
      snoozed_until: tomorrow.toISOString(),
      created_by: authData.user?.id || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id,action_key' });

    if (!error) {
      setItems((current) => current.filter((action) => action.id !== item.id));
      setRecoveredValue((current) => Math.max(0, current - item.recoverableValue));
      setLastSnoozed(item);
    } else {
      console.error('Could not snooze Action Centre item:', error);
    }
    setSnoozingId(null);
  };

  const runAction = async (item: ActionItem) => {
    const businessId = adminUser?.business_id;
    if (!item.unbilledNoShows || !businessId) {
      onNavigate(item.targetView);
      return;
    }

    setSnoozingId(item.id);
    setBillingError(null);
    const { error } = await createUnpaidNoShowFees(businessId, item.unbilledNoShows);
    setSnoozingId(null);
    if (error) {
      setBillingError(t.billingError);
      return;
    }
    onNavigate(item.targetView);
  };

  const undoSnooze = async () => {
    const businessId = adminUser?.business_id;
    if (!businessId || !lastSnoozed) return;

    const item = lastSnoozed;
    const { error } = await supabase
      .from('action_centre_snoozes')
      .delete()
      .eq('business_id', businessId)
      .eq('action_key', item.id);

    if (!error) {
      setItems((current) => [item, ...current]);
      setRecoveredValue((current) => current + item.recoverableValue);
      setLastSnoozed(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl p-5 shadow-[0_2px_16px_rgba(26,23,20,0.05)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-100 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-3.5 w-40 bg-stone-100 rounded animate-pulse" />
            <div className="h-3 w-64 bg-stone-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white/70 shadow-[0_2px_16px_rgba(26,23,20,0.05)] backdrop-blur-xl">
        <div className="flex items-center gap-3 p-5">
          <div className="w-9 h-9 rounded-xl bg-[#F0EDE8] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-stone-600" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1714]">{t.allClear}</p>
            <p className="text-xs text-stone-500">{t.allClearDetail}</p>
          </div>
        </div>
        {lastSnoozed && (
          <div className="flex items-center justify-between gap-3 border-t border-stone-200/70 bg-stone-900/[0.025] px-5 py-2.5 text-xs text-stone-600">
            <span>{t.lastHidden}</span>
            <button type="button" onClick={undoSnooze} className="inline-flex items-center gap-1 font-medium text-stone-800 hover:text-black">
              <Undo2 className="h-3 w-3" />
              {t.undo}
            </button>
          </div>
        )}
      </div>
    );
  }

  const iconFor = (id: ActionId) => {
    if (id === 'refill') return CalendarX2;
    if (id === 'unpaid-fees') return Banknote;
    if (id === 'no-shows') return AlertCircle;
    if (id === 'unbilled-no-shows') return Banknote;
    if (id === 'pending') return AlertCircle;
    if (id === 'lapsed' || id === 'first-timers') return UserX;
    return Repeat2;
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)] overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#1A1714]">{t.title}</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              {fillText(items.length === 1 ? t.itemOne : t.itemMany, { count: items.length })}
            </span>
          </div>
          <p className="text-xs text-stone-500">
            {recoveredValue > 0
              ? fillText(t.recoverable, { amount: formatPrice(recoveredValue) })
              : t.attention}
          </p>
          <p className="mt-1 text-[11px] text-stone-400">{t.hint}</p>
        </div>
      </div>
      <div className="px-2.5 pb-2.5 space-y-1">
        {items.map((item) => {
          const Icon = iconFor(item.id);
          const text = describeItem(item, t, formatPrice);
          return (
            <div
              key={item.id}
              className={`flex flex-col gap-3 px-3 py-3 rounded-xl border sm:flex-row sm:items-center sm:gap-3.5 ${TINTS[item.tint]} transition-colors`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ICON_TINTS[item.tint]}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{text.title}</p>
                  <p className={`text-xs mt-0.5 ${item.tint === 'ink' ? 'text-white/70' : 'opacity-70'}`}>{text.detail}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => snoozeUntilTomorrow(item)}
                  disabled={snoozingId === item.id}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                    item.tint === 'ink' ? 'text-white/65 hover:bg-white/10 hover:text-white' : 'text-stone-500 hover:bg-white/75 hover:text-stone-700'
                  }`}
                  aria-label={fillText(t.hideLabel, { title: text.title })}
                >
                  {snoozingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock3 className="h-3 w-3" />}
                  {t.later}
                </button>
                <button
                  type="button"
                  onClick={() => runAction(item)}
                  disabled={snoozingId === item.id}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    item.tint === 'ink'
                      ? 'bg-white/15 hover:bg-white/25 text-white'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100 hover:shadow-sm'
                  }`}
                >
                  {text.actionLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {billingError && (
        <div role="alert" className="mx-2.5 mb-2.5 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{billingError}</div>
      )}
      {lastSnoozed && (
        <div className="mx-2.5 mb-2.5 flex items-center justify-between gap-3 rounded-xl bg-stone-900/[0.045] px-3 py-2 text-xs text-stone-600">
          <span>{t.hidden}</span>
          <button type="button" onClick={undoSnooze} className="inline-flex items-center gap-1 font-medium text-stone-800 hover:text-black">
            <Undo2 className="h-3 w-3" />
            {t.undo}
          </button>
        </div>
      )}
    </div>
  );
}
