import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, Users, Coins } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

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

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export default function NoShowAnalytics({ businessId }: NoShowAnalyticsProps) {
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
      <div className="bg-white border border-stone-200 p-6 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600">No-Show Rate</span>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-light text-stone-800">{noShowRate.toFixed(1)}%</div>
          <div className="text-xs text-stone-500 mt-1">
            {noShowBookings.length} of {bookings.length} bookings
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600">Revenue Lost</span>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-light text-stone-800">{formatPrice(lostRevenueCents)}</div>
          <div className="text-xs text-stone-500 mt-1">From no-show bookings</div>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600">Fees Recovered</span>
            <Coins className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-light text-stone-800">{formatPrice(feesCollectedCents)}</div>
          <div className="text-xs text-stone-500 mt-1">Paid no-show fees</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 p-6">
          <h3 className="text-sm font-medium text-stone-700 mb-4">No-Shows Over Last {WEEKS_TO_SHOW} Weeks</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {weeklyTrend.map((week) => (
              <div key={week.weekLabel} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-orange-200 hover:bg-orange-300 transition-colors rounded-t"
                  style={{ height: `${(week.count / maxWeeklyCount) * 100}%`, minHeight: week.count > 0 ? '4px' : '0' }}
                  title={`${week.count} no-shows`}
                ></div>
                <span className="text-[10px] text-stone-500 -rotate-45 whitespace-nowrap">{week.weekLabel}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <h3 className="text-sm font-medium text-stone-700 mb-4">No-Shows by Day of Week</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {dayOfWeekBreakdown.map((day) => (
              <div key={day.dayLabel} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-stone-300 hover:bg-stone-400 transition-colors rounded-t"
                  style={{ height: `${(day.count / maxDayCount) * 100}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                  title={`${day.count} no-shows`}
                ></div>
                <span className="text-xs text-stone-500">{day.dayLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {repeatOffenders.length > 0 && (
        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-medium text-stone-700">Repeat No-Show Customers</h3>
          </div>
          <div className="space-y-2">
            {repeatOffenders.map((offender) => (
              <div
                key={offender.customerEmail}
                className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0"
              >
                <div>
                  <div className="text-sm text-stone-800 font-medium">{offender.customerName}</div>
                  <div className="text-xs text-stone-500">{offender.customerEmail}</div>
                </div>
                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">
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
