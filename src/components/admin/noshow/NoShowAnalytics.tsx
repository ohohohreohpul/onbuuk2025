import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Coins, TrendingDown, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import {
  ADMIN_ICON_TILE,
  ADMIN_STATUS_PILL,
  ADMIN_SURFACE,
  ADMIN_SURFACE_INTERACTIVE,
} from '../adminUi';

interface NoShowBookingRow {
  id: string;
  booking_date: string;
  no_show: boolean;
  customer_name: string;
  customer_email: string;
  service_durations: { price_cents: number } | null;
}

interface RepeatOffender {
  customerName: string;
  customerEmail: string;
  count: number;
}

interface WeekBucket {
  weekLabel: string;
  count: number;
}

interface DayBucket {
  dayLabel: string;
  count: number;
}

interface NoShowAnalyticsProps {
  businessId: string;
}

const WEEKS_TO_SHOW = 8;
const TOP_OFFENDERS_LIMIT = 5;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeeklyTrend(rows: NoShowBookingRow[]): WeekBucket[] {
  const now = new Date();
  return Array.from({ length: WEEKS_TO_SHOW }, (_, index) => {
    const weeksAgo = WEEKS_TO_SHOW - 1 - index;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - weeksAgo * 7 - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const count = rows.filter((row) => {
      if (!row.no_show) return false;
      const date = new Date(row.booking_date);
      return date >= weekStart && date < weekEnd;
    }).length;

    return {
      weekLabel: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    };
  });
}

function buildRepeatOffenders(rows: NoShowBookingRow[]): RepeatOffender[] {
  const byCustomer = new Map<string, RepeatOffender>();

  rows
    .filter((row) => row.no_show)
    .forEach((row) => {
      const existing = byCustomer.get(row.customer_email);
      byCustomer.set(row.customer_email, {
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        count: (existing?.count || 0) + 1,
      });
    });

  return Array.from(byCustomer.values())
    .filter((offender) => offender.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_OFFENDERS_LIMIT);
}

function buildDayOfWeekBreakdown(rows: NoShowBookingRow[]): DayBucket[] {
  const counts = DAY_LABELS.map((dayLabel) => ({ dayLabel, count: 0 }));

  rows
    .filter((row) => row.no_show)
    .forEach((row) => {
      const dayIndex = new Date(row.booking_date).getDay();
      counts[dayIndex] = { ...counts[dayIndex], count: counts[dayIndex].count + 1 };
    });

  return counts;
}

export default function NoShowAnalytics({ businessId }: NoShowAnalyticsProps) {
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<NoShowBookingRow[]>([]);
  const [feesCollectedCents, setFeesCollectedCents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [businessId]);

  const fetchAnalyticsData = async () => {
    setLoading(true);

    const [bookingsResult, feesResult] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, no_show, customer_name, customer_email, service_durations(price_cents)')
        .eq('business_id', businessId),
      supabase
        .from('no_show_fees')
        .select('amount, booking:bookings!inner(business_id)')
        .eq('booking.business_id', businessId)
        .eq('paid', true),
    ]);

    if (bookingsResult.error) {
      console.error('Error fetching no-show analytics bookings:', bookingsResult.error);
    } else if (bookingsResult.data) {
      setBookings(bookingsResult.data as unknown as NoShowBookingRow[]);
    }

    if (feesResult.error) {
      console.error('Error fetching no-show fees for analytics:', feesResult.error);
    } else if (feesResult.data) {
      setFeesCollectedCents(feesResult.data.reduce((sum, fee: { amount: number }) => sum + fee.amount, 0));
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className={`${ADMIN_SURFACE} h-36 bg-stone-900/[0.035]`} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={`${ADMIN_SURFACE} h-56 bg-stone-900/[0.035]`} />
          <div className={`${ADMIN_SURFACE} h-56 bg-stone-900/[0.035]`} />
        </div>
      </div>
    );
  }

  const noShowBookings = bookings.filter((row) => row.no_show);
  const noShowRate = bookings.length > 0 ? (noShowBookings.length / bookings.length) * 100 : 0;
  const lostRevenueCents = noShowBookings.reduce(
    (sum, row) => sum + (row.service_durations?.price_cents || 0),
    0
  );
  const weeklyTrend = buildWeeklyTrend(bookings);
  const repeatOffenders = buildRepeatOffenders(bookings);
  const dayOfWeekBreakdown = buildDayOfWeekBreakdown(bookings);
  const maxWeeklyCount = Math.max(1, ...weeklyTrend.map((w) => w.count));
  const maxDayCount = Math.max(1, ...dayOfWeekBreakdown.map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <div className={ADMIN_ICON_TILE}>
              <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className={`${ADMIN_STATUS_PILL} bg-amber-50 text-amber-700`}>
              {noShowBookings.length} missed
            </span>
          </div>
          <p className="mb-1 text-[13px] font-medium text-stone-500">No-show rate</p>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{noShowRate.toFixed(1)}%</div>
          <div className="mt-1 text-xs text-stone-400">
            {noShowBookings.length} of {bookings.length} bookings
          </div>
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <div className={ADMIN_ICON_TILE}>
              <TrendingDown className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className={`${ADMIN_STATUS_PILL} bg-stone-900/[0.05] text-stone-500`}>
              missed value
            </span>
          </div>
          <p className="mb-1 text-[13px] font-medium text-stone-500">Revenue lost</p>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(lostRevenueCents)}</div>
          <div className="mt-1 text-xs text-stone-400">From no-show bookings</div>
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <div className={ADMIN_ICON_TILE}>
              <Coins className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className={`${ADMIN_STATUS_PILL} bg-emerald-50 text-emerald-700`}>
              collected
            </span>
          </div>
          <p className="mb-1 text-[13px] font-medium text-stone-500">Fees recovered</p>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(feesCollectedCents)}</div>
          <div className="mt-1 text-xs text-stone-400">Paid no-show fees</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${ADMIN_SURFACE} p-5`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900/[0.05]">
              <BarChart3 className="h-4 w-4 text-stone-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[#1A1714]">Eight-week trend</h3>
              <p className="text-xs text-stone-400">No-shows by week</p>
            </div>
          </div>
          <div className="flex h-36 items-end justify-between gap-2">
            {weeklyTrend.map((week) => (
              <div key={week.weekLabel} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={`text-[10px] font-medium tabular-nums ${week.count ? 'text-stone-600' : 'text-stone-300'}`}>
                  {week.count || ''}
                </span>
                <div
                  className="w-full rounded-md bg-[#1A1714] transition-all duration-500 hover:bg-[#2E2926]"
                  style={{ height: `${Math.max((week.count / maxWeeklyCount) * 100, week.count > 0 ? 10 : 3)}%` }}
                  title={`${week.count} no-shows`}
                />
                <span className="whitespace-nowrap text-[10px] text-stone-400">{week.weekLabel}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${ADMIN_SURFACE} p-5`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900/[0.05]">
              <BarChart3 className="h-4 w-4 text-stone-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[#1A1714]">Day pattern</h3>
              <p className="text-xs text-stone-400">No-shows by weekday</p>
            </div>
          </div>
          <div className="flex h-36 items-end justify-between gap-2">
            {dayOfWeekBreakdown.map((day) => (
              <div key={day.dayLabel} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={`text-[10px] font-medium tabular-nums ${day.count ? 'text-stone-600' : 'text-stone-300'}`}>
                  {day.count || ''}
                </span>
                <div
                  className="w-full rounded-md bg-stone-900/[0.14] transition-all duration-500 hover:bg-stone-900/25"
                  style={{ height: `${Math.max((day.count / maxDayCount) * 100, day.count > 0 ? 10 : 3)}%` }}
                  title={`${day.count} no-shows`}
                />
                <span className="text-[10px] text-stone-400">{day.dayLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {repeatOffenders.length > 0 && (
        <div className={`${ADMIN_SURFACE} p-5`}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900/[0.05]">
              <Users className="h-4 w-4 text-stone-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[#1A1714]">Repeat no-shows</h3>
              <p className="text-xs text-stone-400">Customers with more than one missed booking</p>
            </div>
          </div>
          <div className="divide-y divide-stone-200/60 overflow-hidden rounded-xl bg-stone-900/[0.025] px-3">
            {repeatOffenders.map((offender) => (
              <div
                key={offender.customerEmail}
                className="flex items-center justify-between gap-4 px-1 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-[#1A1714]">{offender.customerName}</div>
                  <div className="mt-0.5 text-xs text-stone-400">{offender.customerEmail}</div>
                </div>
                <span className={`${ADMIN_STATUS_PILL} bg-amber-50 text-amber-700`}>
                  {offender.count} no-shows
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
