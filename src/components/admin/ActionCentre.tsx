import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { adminAuth } from '../../lib/adminAuth';
import { executeWithTimeout } from '../../lib/queryUtils';
import { AlertCircle, CalendarX2, UserX, Banknote, Repeat2, ArrowRight, Sparkles, Clock3, Undo2, Loader2 } from 'lucide-react';
import { useCurrency } from '../../lib/currencyContext';
import { createUnpaidNoShowFees, type UnbilledNoShow } from '../../lib/noShowFees';
import { REGULAR_MIN_VISITS, fetchCustomerStatsForBusiness } from '../../lib/customerStats';

interface ActionItem {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  targetView: string;
  tint: 'amber' | 'stone' | 'red' | 'ink';
  signature: string;
  recoverableValue: number;
  unbilledNoShows?: UnbilledNoShow[];
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
          title: `${cancellations.length} upcoming slot${cancellations.length === 1 ? '' : 's'} freed by cancellation`,
          detail: `Worth ${formatPrice(est)}. Offer ${cancellations.length === 1 ? 'it' : 'them'} to a regular or your waitlist, then use Later once you've reached out.`,
          actionLabel: 'Open bookings',
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
          title: `${unpaid.length} no-show fee${unpaid.length === 1 ? '' : 's'} unpaid`,
          detail: `${formatPrice(owed)} outstanding. Charge the saved card, record another payment, or waive the fee.`,
          actionLabel: 'Resolve fee',
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
          title: `${unbilled.length} no-show${unbilled.length === 1 ? ' was' : 's were'} never billed`,
          detail: `${formatPrice(owedUnbilled)} in fees under your policy. Add them to No-Show Fees, then charge, record or waive each one.`,
          actionLabel: 'Add fees',
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
          title: `${withoutPolicy.length} no-show${withoutPolicy.length === 1 ? '' : 's'} on services without a fee`,
          detail: 'Set a no-show fee on these services so the next missed appointment is covered.',
          actionLabel: 'Set a fee',
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
          title: `${pendingUp.length} upcoming booking${pendingUp.length === 1 ? '' : 's'} awaiting confirmation`,
          detail: 'Confirm them so customers don\'t wonder whether they\'re booked.',
          actionLabel: 'Confirm now',
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
          title: `${lapsedRegulars.length} regular client${lapsedRegulars.length === 1 ? " hasn't" : 's haven\'t'} been in for 30+ days`,
          detail: 'They know the service and loved it. A short "we miss you" usually brings them back.',
          actionLabel: 'View customers',
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
          title: `${firstTimers.length} first-time client${firstTimers.length === 1 ? " hasn't" : 's haven\'t'} rebooked`,
          detail: 'The second visit is the hardest to win. A personal follow-up now converts best.',
          actionLabel: 'View customers',
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
      setBillingError(error);
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
            <p className="text-sm font-semibold text-[#1A1714]">All clear</p>
            <p className="text-xs text-stone-500">Nothing needs your attention right now. Resolved tasks stay closed; snoozed items return tomorrow.</p>
          </div>
        </div>
        {lastSnoozed && (
          <div className="flex items-center justify-between gap-3 border-t border-stone-200/70 bg-stone-900/[0.025] px-5 py-2.5 text-xs text-stone-600">
            <span>Last item hidden until tomorrow.</span>
            <button type="button" onClick={undoSnooze} className="inline-flex items-center gap-1 font-medium text-stone-800 hover:text-black">
              <Undo2 className="h-3 w-3" />
              Undo
            </button>
          </div>
        )}
      </div>
    );
  }

  const iconFor = (id: string) => {
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
            <h2 className="text-[15px] font-semibold tracking-tight text-[#1A1714]">Action Centre</h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              {items.length} item{items.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-stone-500">
            {recoveredValue > 0
              ? `Up to ${formatPrice(recoveredValue)} recoverable today if you act on these.`
              : 'What needs your attention today.'}
          </p>
          <p className="mt-1 text-[11px] text-stone-400">Resolve the underlying task, or use Later to hide it until tomorrow.</p>
        </div>
      </div>
      <div className="px-2.5 pb-2.5 space-y-1">
        {items.map((item) => {
          const Icon = iconFor(item.id);
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
                  <p className="text-sm font-medium leading-tight">{item.title}</p>
                  <p className={`text-xs mt-0.5 ${item.tint === 'ink' ? 'text-white/70' : 'opacity-70'}`}>{item.detail}</p>
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
                  aria-label={`Hide ${item.title} until tomorrow`}
                >
                  {snoozingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock3 className="h-3 w-3" />}
                  Later
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
                  {item.actionLabel}
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
          <span>Hidden until tomorrow.</span>
          <button type="button" onClick={undoSnooze} className="inline-flex items-center gap-1 font-medium text-stone-800 hover:text-black">
            <Undo2 className="h-3 w-3" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
