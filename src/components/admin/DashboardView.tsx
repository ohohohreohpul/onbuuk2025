import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  ChevronDown,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import CreateBookingModal from './CreateBookingModal';
import ActionCentre from './ActionCentre';
import GiftCardStation from './GiftCardStation';
import { supabase } from '../../lib/supabase';
import { executeWithTimeout, getUserFriendlyErrorMessage } from '../../lib/queryUtils';
import { usePermissions } from '../../hooks/usePermissions';
import { adminAuth } from '../../lib/adminAuth';
import { Button } from '../ui/button';
import { useCurrency } from '../../lib/currencyContext';

interface DashboardStats {
  totalBookings: number;
  bookingsThisMonth: number;
  bookingsPrevMonth: number;
  todayBookings: number;
  revenueThisMonth: number;
  revenuePrevMonth: number;
  totalRevenue: number;
  totalCustomers: number;
  noShowCount: number;
  noShowRate: number;
}

interface RecentBooking {
  id: string;
  customer_name: string;
  booking_date: string;
  start_time: string;
  status: string;
  service_name: string;
  price_cents: number;
}

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

const ZERO_STATS: DashboardStats = {
  totalBookings: 0,
  bookingsThisMonth: 0,
  bookingsPrevMonth: 0,
  todayBookings: 0,
  revenueThisMonth: 0,
  revenuePrevMonth: 0,
  totalRevenue: 0,
  totalCustomers: 0,
  noShowCount: 0,
  noShowRate: 0,
};

// Zenno surface tokens — warm off-white, ink text, hairline border
const SURFACE =
  'bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)] hover:shadow-[0_8px_28px_rgba(26,23,20,0.08)] transition-shadow duration-300';
const ICON_TILE =
  'w-11 h-11 rounded-xl bg-stone-900/[6%] text-[#1A1714] flex items-center justify-center shrink-0';

const localISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const monthKey = (dateString: string) => dateString.slice(0, 7);

function delta(current: number, previous: number) {
  if (previous === 0) {
    return current > 0
      ? { text: 'New this month', tone: 'up' as const }
      : { text: 'No change vs last month', tone: 'flat' as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: 'No change vs last month', tone: 'flat' as const };
  return {
    text: `${pct > 0 ? '+' : ''}${pct}% vs last month`,
    tone: pct > 0 ? ('up' as const) : ('down' as const),
  };
}

function DeltaPill({ current, previous }: { current: number; previous: number }) {
  const d = delta(current, previous);
  const Icon = d.tone === 'up' ? TrendingUp : d.tone === 'down' ? TrendingDown : Minus;
  const toneClass =
    d.tone === 'up'
      ? 'bg-stone-900 text-white'
      : d.tone === 'down'
        ? 'bg-red-50 text-red-700 border border-red-100'
        : 'bg-stone-100 text-stone-500';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${toneClass}`}
    >
      <Icon className="w-3 h-3" />
      {d.text}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === 'confirmed'
      ? 'bg-stone-900/[6%] text-stone-700 border border-stone-200'
      : status === 'pending'
        ? 'bg-amber-50 text-amber-700 border border-amber-200'
        : status === 'completed'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : status === 'cancelled'
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-stone-100 text-stone-500 border border-stone-200';
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

// Weekly booking volume — last 7 days, ending today
function WeeklyBars({ days }: { days: { label: string; count: number; isToday: boolean }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-28">
      {days.map((day) => (
        <div key={day.label} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
          <span
            className={`text-[11px] font-medium tabular-nums ${
              day.count > 0 ? 'text-stone-700' : 'text-stone-300'
            }`}
          >
            {day.count > 0 ? day.count : ''}
          </span>
          <div
            className={`w-full rounded-md transition-all duration-500 ${
              day.isToday ? 'bg-[#1A1714]' : 'bg-stone-900/[14%]'
            }`}
            style={{ height: `${Math.max((day.count / max) * 100, day.count > 0 ? 10 : 4)}%` }}
          />
          <span
            className={`text-[10px] ${day.isToday ? 'text-stone-900 font-semibold' : 'text-stone-400'}`}
          >
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const adminUser = adminAuth.getCurrentUser();
  const { hasPermission } = usePermissions(adminUser?.id || null);
  const { formatPrice } = useCurrency();
  const [stats, setStats] = useState<DashboardStats>(ZERO_STATS);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [weeklyDays, setWeeklyDays] = useState<{ label: string; count: number; isToday: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    fetchDashboardData();
    setTimeout(() => setIsLoaded(true), 50);

    return () => {
      mountedRef.current = false;
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateAction = (action: string) => {
    setShowCreateDropdown(false);
    if (action === 'create-booking') setShowCreateBookingModal(true);
    else onNavigate(action);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!mountedRef.current) return;

    const businessId = adminUser?.business_id;
    if (!businessId) {
      setError('Unable to determine your business. Please try logging in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && loading) {
        setError('Dashboard is taking too long to load. Please refresh the page.');
        setLoading(false);
      }
    }, 10000);

    try {
      const [bookingResult, customerResult] = await Promise.all([
        executeWithTimeout(
          supabase
            .from('bookings')
            .select(
              `id, customer_name, customer_email, booking_date, start_time, status, no_show, created_at,
               services (name), service_durations (price_cents)`
            )
            .eq('business_id', businessId)
            .order('booking_date', { ascending: false })
            .order('start_time', { ascending: false }),
          { timeout: 8000, retries: 2 }
        ),
        executeWithTimeout(
          supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId),
          { timeout: 8000, retries: 2 }
        ),
      ]);

      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (bookingResult.error) throw bookingResult.error;
      if (!mountedRef.current) return;

      const bookings = (bookingResult.data || []) as any[];
      const now = new Date();
      const today = localISODate(now);
      const thisMonth = monthKey(today);
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

      // Revenue: only bookings that actually happened and weren't cancelled/no-shows
      const countsForRevenue = (b: any) => b.status !== 'cancelled' && !b.no_show;
      const priceOf = (b: any) => b.service_durations?.price_cents || 0;

      const totalRevenue = bookings.filter(countsForRevenue).reduce((s, b) => s + priceOf(b), 0);
      const revenueThisMonth = bookings
        .filter((b) => countsForRevenue(b) && monthKey(b.booking_date) === thisMonth)
        .reduce((s, b) => s + priceOf(b), 0);
      const revenuePrevMonth = bookings
        .filter((b) => countsForRevenue(b) && monthKey(b.booking_date) === prevMonth)
        .reduce((s, b) => s + priceOf(b), 0);

      const bookingsThisMonth = bookings.filter((b) => monthKey(b.booking_date) === thisMonth).length;
      const bookingsPrevMonth = bookings.filter((b) => monthKey(b.booking_date) === prevMonth).length;

      const uniqueBookingEmails = new Set(bookings.map((b) => b.customer_email).filter(Boolean)).size;
      const noShowCount = bookings.filter((b) => b.no_show).length;

      setStats({
        totalBookings: bookings.length,
        bookingsThisMonth,
        bookingsPrevMonth,
        todayBookings: bookings.filter((b) => b.booking_date === today).length,
        revenueThisMonth,
        revenuePrevMonth,
        totalRevenue,
        totalCustomers: customerResult.count ?? uniqueBookingEmails,
        noShowCount,
        noShowRate: bookings.length > 0 ? (noShowCount / bookings.length) * 100 : 0,
      });

      // recent 5 by actual appointment date
      setRecentBookings(
        bookings.slice(0, 5).map((b: any) => ({
          id: b.id,
          customer_name: b.customer_name,
          booking_date: b.booking_date,
          start_time: b.start_time?.slice(0, 5) || '',
          status: b.status,
          service_name: b.services?.name || 'Unknown',
          price_cents: b.service_durations?.price_cents || 0,
        }))
      );

      // last 7 days trend
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const iso = localISODate(d);
        return {
          label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
          count: bookings.filter((b) => b.booking_date === iso).length,
          isToday: iso === today,
        };
      });
      setWeeklyDays(days);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      if (mountedRef.current) setError(getUserFriendlyErrorMessage(err));
    } finally {
      if (mountedRef.current) setLoading(false);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    }
  }, [adminUser?.business_id, loading]);

  const formatDate = (dateString: string) =>
    new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-stone-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">Dashboard</h1>
        <div className={`${SURFACE} border-red-200 bg-red-50/70 p-6`}>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">Unable to load dashboard</h3>
              <p className="text-sm text-red-700 mb-4">{error}</p>
              <Button
                onClick={() => {
                  setError(null);
                  fetchDashboardData();
                }}
                variant="outline"
                size="sm"
                className="border-red-300 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Bookings',
      value: String(stats.totalBookings),
      delta: <DeltaPill current={stats.bookingsThisMonth} previous={stats.bookingsPrevMonth} />,
      icon: Calendar,
    },
    {
      title: "Today's Bookings",
      value: String(stats.todayBookings),
      delta: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-500">
          Active appointments today
        </span>
      ),
      icon: Calendar,
    },
    ...(hasPermission('view_revenue')
      ? [
          {
            title: 'Total Revenue',
            value: formatPrice(stats.totalRevenue),
            delta: <DeltaPill current={stats.revenueThisMonth} previous={stats.revenuePrevMonth} />,
            icon: DollarSign,
          },
        ]
      : []),
    {
      title: 'Total Customers',
      value: String(stats.totalCustomers),
      delta: (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-500">
          Unique client profiles
        </span>
      ),
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`flex items-center justify-between transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">Dashboard</h1>
          </div>
          <p className="text-sm text-stone-500">Welcome back! Here's what's happening today</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <Button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="bg-[#1A1714] hover:bg-[#2E2926] text-white rounded-xl shadow-[0_2px_12px_rgba(26,23,20,0.16)]"
          >
            <Plus className="h-4 w-4" />
            New
            <ChevronDown
              className={`h-4 w-4 ml-1 transition-transform duration-200 ${showCreateDropdown ? 'rotate-180' : ''}`}
            />
          </Button>
          {showCreateDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-stone-200/80 bg-white/95 backdrop-blur-xl p-1.5 shadow-[0_12px_40px_rgba(26,23,20,0.14)] z-[9999] animate-fade-in-down">
              {[
                { action: 'create-booking', label: 'Create Booking', icon: Calendar },
                { action: 'customers', label: 'Add Customer', icon: Users },
                { action: 'gift-cards', label: 'Issue Gift Card', icon: DollarSign },
              ].map((item) => (
                <button
                  key={item.action}
                  onClick={() => handleCreateAction(item.action)}
                  className="relative flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-100 transition-colors"
                >
                  <item.icon className="mr-3 h-4 w-4 text-stone-500" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Centre — daily briefing */}
      <div className={`transform transition-all duration-500 delay-75 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <ActionCentre onNavigate={onNavigate} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.title}
            className={`${SURFACE} p-5 transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionDelay: `${index * 60}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={ICON_TILE}>
                <stat.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              {stat.delta || null}
            </div>
            <p className="text-[13px] font-medium text-stone-500 mb-1">{stat.title}</p>
            <p className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* No-show alert */}
      {stats.noShowCount > 0 && (
        <div
          className={`${SURFACE} border-amber-200 bg-amber-50/60 p-4 transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-amber-100 shrink-0">
              <AlertCircle className="h-5 w-5 text-amber-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {stats.noShowCount} no-show{stats.noShowCount === 1 ? '' : 's'} (
                {stats.noShowRate.toFixed(1)}% of bookings)
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Review no-show fees, trends, and repeat offenders
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('fees')}
              className="border-amber-300 hover:bg-amber-100 text-amber-800 shrink-0"
            >
              View Details
            </Button>
          </div>
        </div>
      )}

      {/* Weekly activity + Gift Card Station */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className={`${SURFACE} p-5 transform transition-all duration-500 delay-100 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={ICON_TILE}>
                <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#1A1714] tracking-tight">
                  Bookings this week
                </h3>
                <p className="text-xs text-stone-400">Last 7 days, ending today</p>
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight text-[#1A1714] tabular-nums">
              {weeklyDays.reduce((s, d) => s + d.count, 0)}
            </span>
          </div>
          <WeeklyBars days={weeklyDays} />
        </div>

        <div
          className={`transform transition-all duration-500 delay-150 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        >
          <GiftCardStation businessId={adminUser?.business_id || ''} onNavigate={onNavigate} />
        </div>
      </div>

      {/* Recent Bookings */}
      <div
        className={`${SURFACE} transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className={ICON_TILE}>
              <Calendar className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[#1A1714] tracking-tight">
                Recent Bookings
              </h3>
              <p className="text-xs text-stone-400">Latest appointments by date</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('bookings')}
            className="border-stone-200 hover:bg-stone-100 text-stone-600 rounded-xl"
          >
            View All
            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        <div className="px-2.5 pb-2.5">
          {recentBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-[#F0EDE8] rounded-2xl mb-4">
                <Calendar className="h-7 w-7 text-stone-400" strokeWidth={1.75} />
              </div>
              <h3 className="font-semibold text-[#1A1714]">No bookings yet</h3>
              <p className="text-sm text-stone-500 mt-1 mb-4">Create your first booking to get started</p>
              <Button
                onClick={() => setShowCreateBookingModal(true)}
                className="bg-[#1A1714] hover:bg-[#2E2926] text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Booking
              </Button>
            </div>
          ) : (
            recentBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-4 px-2.5 py-3 rounded-xl hover:bg-stone-50/80 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#F0EDE8] flex items-center justify-center text-[13px] font-semibold text-[#1A1714] shrink-0">
                  {booking.customer_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1714] truncate">{booking.customer_name}</p>
                  <p className="text-xs text-stone-500 truncate">{booking.service_name}</p>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <p className="text-sm font-medium text-stone-700">{formatDate(booking.booking_date)}</p>
                  <p className="text-xs text-stone-400">{booking.start_time}</p>
                </div>
                {hasPermission('view_revenue') && booking.price_cents > 0 && (
                  <span className="text-sm font-semibold text-[#1A1714] tabular-nums shrink-0 w-20 text-right">
                    {formatPrice(booking.price_cents)}
                  </span>
                )}
                <StatusPill status={booking.status} />
              </div>
            ))
          )}
        </div>
      </div>

      <CreateBookingModal
        isOpen={showCreateBookingModal}
        onClose={() => setShowCreateBookingModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowCreateBookingModal(false);
        }}
      />
    </div>
  );
}
