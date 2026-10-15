import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Coins, TrendingDown, Users } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
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

const TEXT: Translations<{
  missed: string; noShowRate: string; ofBookings: string; missedValue: string; revenueLost: string; fromNoShows: string;
  collected: string; feesRecovered: string; paidFees: string; weekTrend: string; byWeek: string; dayPattern: string;
  byWeekday: string; repeatTitle: string; repeatSubtitle: string; noShowOne: string; noShowMany: string;
}> = {
  en: {
    missed: '{count} missed', noShowRate: 'No-show rate', ofBookings: '{count} of {total} bookings', missedValue: 'missed value',
    revenueLost: 'Revenue lost', fromNoShows: 'From no-show bookings', collected: 'collected', feesRecovered: 'Fees recovered',
    paidFees: 'Paid no-show fees', weekTrend: 'Eight-week trend', byWeek: 'No-shows by week', dayPattern: 'Day pattern',
    byWeekday: 'No-shows by weekday', repeatTitle: 'Repeat no-shows', repeatSubtitle: 'Customers with more than one missed booking',
    noShowOne: '{count} no-show', noShowMany: '{count} no-shows',
  },
  de: {
    missed: '{count} verpasst', noShowRate: 'No-Show-Quote', ofBookings: '{count} von {total} Buchungen', missedValue: 'entgangener Wert',
    revenueLost: 'Entgangener Umsatz', fromNoShows: 'Aus No-Show-Buchungen', collected: 'eingenommen', feesRecovered: 'Eingenommene Gebühren',
    paidFees: 'Bezahlte No-Show-Gebühren', weekTrend: 'Verlauf über acht Wochen', byWeek: 'No-Shows pro Woche', dayPattern: 'Wochentage',
    byWeekday: 'No-Shows pro Wochentag', repeatTitle: 'Wiederholte No-Shows', repeatSubtitle: 'Kunden mit mehr als einem verpassten Termin',
    noShowOne: '{count} No-Show', noShowMany: '{count} No-Shows',
  },
  th: {
    missed: 'ไม่มา {count}', noShowRate: 'อัตราไม่มาตามนัด', ofBookings: '{count} จาก {total} การจอง', missedValue: 'มูลค่าที่เสียไป',
    revenueLost: 'รายได้ที่เสียไป', fromNoShows: 'จากการจองที่ไม่มาตามนัด', collected: 'เก็บได้แล้ว', feesRecovered: 'ค่าธรรมเนียมที่เก็บได้',
    paidFees: 'ค่าธรรมเนียมไม่มาตามนัดที่ชำระแล้ว', weekTrend: 'แนวโน้ม 8 สัปดาห์', byWeek: 'ไม่มาตามนัดรายสัปดาห์', dayPattern: 'รูปแบบตามวัน',
    byWeekday: 'ไม่มาตามนัดตามวันในสัปดาห์', repeatTitle: 'ไม่มาตามนัดซ้ำ', repeatSubtitle: 'ลูกค้าที่ไม่มาตามนัดมากกว่าหนึ่งครั้ง',
    noShowOne: 'ไม่มา {count} ครั้ง', noShowMany: 'ไม่มา {count} ครั้ง',
  },
};

const WEEKS_TO_SHOW = 8;
const TOP_OFFENDERS_LIMIT = 5;
const DAYS_IN_WEEK = 7;
// 1 January 2023 was a Sunday, so day n of that week has getDay() === n.
const weekdayLabel = (dayIndex: number, locale: string): string =>
  new Date(2023, 0, 1 + dayIndex).toLocaleDateString(locale, { weekday: 'short' });

function buildWeeklyTrend(rows: NoShowBookingRow[], locale: string): WeekBucket[] {
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
      weekLabel: weekStart.toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
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

function buildDayOfWeekBreakdown(rows: NoShowBookingRow[], locale: string): DayBucket[] {
  const counts = Array.from({ length: DAYS_IN_WEEK }, (_, dayIndex) => ({ dayLabel: weekdayLabel(dayIndex, locale), count: 0 }));

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
  const { t, locale } = useAdminText(TEXT);
  const noShowCount = (count: number) => fillText(count === 1 ? t.noShowOne : t.noShowMany, { count });
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
  const weeklyTrend = buildWeeklyTrend(bookings, locale);
  const repeatOffenders = buildRepeatOffenders(bookings);
  const dayOfWeekBreakdown = buildDayOfWeekBreakdown(bookings, locale);
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
              {fillText(t.missed, { count: noShowBookings.length })}
            </span>
          </div>
          <p className="mb-1 text-[13px] font-medium text-stone-500">{t.noShowRate}</p>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{noShowRate.toFixed(1)}%</div>
          <div className="mt-1 text-xs text-stone-400">
            {fillText(t.ofBookings, { count: noShowBookings.length, total: bookings.length })}
          </div>
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <div className={ADMIN_ICON_TILE}>
              <TrendingDown className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className={`${ADMIN_STATUS_PILL} bg-stone-900/[0.05] text-stone-500`}>
              {t.missedValue}
            </span>
          </div>
          <p className="mb-1 text-[13px] font-medium text-stone-500">{t.revenueLost}</p>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(lostRevenueCents)}</div>
          <div className="mt-1 text-xs text-stone-400">{t.fromNoShows}</div>
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="mb-4 flex items-start justify-between">
            <div className={ADMIN_ICON_TILE}>
              <Coins className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className={`${ADMIN_STATUS_PILL} bg-emerald-50 text-emerald-700`}>
              {t.collected}
            </span>
          </div>
          <p className="mb-1 text-[13px] font-medium text-stone-500">{t.feesRecovered}</p>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(feesCollectedCents)}</div>
          <div className="mt-1 text-xs text-stone-400">{t.paidFees}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${ADMIN_SURFACE} p-5`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900/[0.05]">
              <BarChart3 className="h-4 w-4 text-stone-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[#1A1714]">{t.weekTrend}</h3>
              <p className="text-xs text-stone-400">{t.byWeek}</p>
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
                  title={noShowCount(week.count)}
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
              <h3 className="text-sm font-semibold tracking-tight text-[#1A1714]">{t.dayPattern}</h3>
              <p className="text-xs text-stone-400">{t.byWeekday}</p>
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
                  title={noShowCount(day.count)}
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
              <h3 className="text-sm font-semibold tracking-tight text-[#1A1714]">{t.repeatTitle}</h3>
              <p className="text-xs text-stone-400">{t.repeatSubtitle}</p>
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
                  {noShowCount(offender.count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
