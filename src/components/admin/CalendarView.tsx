import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { executeWithTimeout } from '../../lib/queryUtils';
import { adminAuth } from '../../lib/adminAuth';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, Clock, Wallet, Plus } from 'lucide-react';
import CreateBookingModal from './CreateBookingModal';
import { useCurrency } from '../../lib/currencyContext';
import { usePermissions } from '../../hooks/usePermissions';

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_name: string;
  specialist_name: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  total_price_cents: number | null;
  status: string;
  no_show: boolean;
  is_pair_booking: boolean;
  services?: { name: string } | null;
  service_durations?: { price_cents: number } | null;
}

interface BookingStats {
  todayBookings: number;
  weekRevenue: number;
  monthBookings: number;
  upcomingToday: Booking[];
}

// Zenno surface language — matches the dashboard
const SURFACE =
  'bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)]';
const ICON_TILE =
  'w-10 h-10 rounded-xl bg-stone-900/[6%] text-[#1A1714] flex items-center justify-center shrink-0';

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
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${style}`}>{status}</span>;
}

const priceOf = (b: Booking) =>
  b.total_price_cents ?? b.service_durations?.price_cents ?? 0;

const countable = (b: Booking) => b.status !== 'cancelled' && !b.no_show;

export default function CalendarView() {
  const adminUser = adminAuth.getCurrentUser();
  const { hasPermission } = usePermissions(adminUser?.id || null);
  const { formatPrice } = useCurrency();
  const canSeeRevenue = hasPermission('view_revenue');
  const businessId = adminUser?.business_id;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats>({
    todayBookings: 0,
    weekRevenue: 0,
    monthBookings: 0,
    upcomingToday: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchBookings();
    setTimeout(() => setIsLoaded(true), 50);
    return () => {
      mountedRef.current = false;
    };
  }, [currentDate]);

  const fetchBookings = async () => {
    if (!mountedRef.current || !businessId) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    // include a trailing-month slice so stats can cross month boundaries
    const rangeStart = new Date(year, month - 1, 1);

    try {
      const rangeStartIso = rangeStart.toISOString().split('T')[0];
      const monthStartIso = monthStart.toISOString().split('T')[0];
      const monthEndIso = monthEnd.toISOString().split('T')[0];

      const result = await executeWithTimeout(
        supabase
          .from('bookings')
          .select('*, services(name), service_durations(price_cents)')
          .eq('business_id', businessId)
          .gte('booking_date', rangeStartIso)
          .lte('booking_date', monthEndIso)
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true }),
        { timeout: 8000, retries: 2 }
      );

      if (!result.error && result.data && mountedRef.current) {
        const all = result.data as Booking[];
        const monthBookings = all.filter((b) => b.booking_date >= monthStartIso);

        const todayIso = new Date().toDateString();
        const todayBookings = monthBookings.filter(
          (b) => new Date(b.booking_date + 'T00:00:00').toDateString() === todayIso
        );

        const startOfWeek = new Date();
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const weekFromNow: Booking[] = all.filter((b) => {
          const d = new Date(b.booking_date + 'T00:00:00');
          return d >= startOfWeek;
        });

        setBookings(monthBookings);
        setStats({
          todayBookings: todayBookings.length,
          weekRevenue: weekFromNow.reduce((sum, b) => sum + (countable(b) ? priceOf(b) : 0), 0),
          monthBookings: monthBookings.length,
          upcomingToday:
            todayBookings
              .filter((b) => {
                const t = new Date(`${b.booking_date}T${b.start_time}`);
                return t > new Date() && b.status !== 'cancelled';
              })
              .slice(0, 5) || [],
        });
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDayOfWeek = new Date(year, month, 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getBookingsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter((b) => b.booking_date === dateStr);
  };

  const handleDateClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    setDayBookings(getBookingsForDay(day));
  };

  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const formatTime = (time: string) => time.slice(0, 5);
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-stone-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  const days = getDaysInMonth();
  const statCards = [
    { title: "Today's Bookings", value: String(stats.todayBookings), icon: CalendarIcon },
    ...(canSeeRevenue
      ? [{ title: 'Revenue This Week', value: formatPrice(stats.weekRevenue), icon: Wallet }]
      : []),
    { title: 'Bookings This Month', value: String(stats.monthBookings), icon: TrendingUp },
    { title: 'Upcoming Today', value: String(stats.upcomingToday.length), icon: Clock },
  ];

  const listBookings = selectedDate ? dayBookings : stats.upcomingToday;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={`flex items-center justify-between transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">Calendar</h1>
          <p className="text-sm text-stone-500">View and manage bookings</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-[#1A1714] hover:bg-[#2E2926] text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-[0_2px_12px_rgba(26,23,20,0.16)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Booking</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.title}
            className={`${SURFACE} p-5 transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={ICON_TILE}>
                <stat.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-[13px] font-medium text-stone-500 mb-1">{stat.title}</p>
            <p className="text-2xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Month grid */}
        <div
          className={`lg:col-span-2 ${SURFACE} p-5 transform transition-all duration-500 delay-100 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-[#1A1714] tracking-tight">{monthYear}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setCurrentDate(new Date());
                  setSelectedDate(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-semibold text-stone-400 pb-2 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} className="aspect-square" />;

              const dayBookingsForCell = getBookingsForDay(day);
              const activeCount = dayBookingsForCell.filter((b) => b.status !== 'cancelled').length;
              const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const isToday = cellDate.toDateString() === new Date().toDateString();
              const isSelected = selectedDate?.toDateString() === cellDate.toDateString();

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={`aspect-square rounded-xl border transition-all duration-150 flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-[#1A1714] text-white border-[#1A1714] shadow-[0_2px_12px_rgba(26,23,20,0.2)]'
                      : isToday
                        ? 'bg-[#F0EDE8] border-stone-300'
                        : 'border-stone-200/70 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      isSelected ? 'text-white' : isToday ? 'text-[#1A1714]' : 'text-stone-600'
                    }`}
                  >
                    {day}
                  </span>
                  {activeCount > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-stone-900/[7%] text-stone-600'
                      }`}
                    >
                      {activeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div
          className={`${SURFACE} p-5 transform transition-all duration-500 delay-150 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-[#1A1714] tracking-tight">
              {selectedDate
                ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                : 'Upcoming Today'}
            </h2>
            <span className="text-xs text-stone-400">{listBookings.length} appointment{listBookings.length === 1 ? '' : 's'}</span>
          </div>

          {listBookings.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="p-3 bg-[#F0EDE8] rounded-xl mb-3">
                <Clock className="h-5 w-5 text-stone-400" strokeWidth={1.75} />
              </div>
              <p className="text-sm text-stone-500">No bookings</p>
              <p className="text-xs text-stone-400 mt-1">
                {selectedDate ? 'Nothing scheduled for this day' : 'No more appointments today'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {listBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border border-stone-200/70 bg-white/80 rounded-xl p-3 hover:border-stone-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1A1714] tabular-nums">
                        {formatTime(booking.start_time)}
                      </span>
                      <span className="text-xs text-stone-400">
                        {booking.duration_minutes} min
                      </span>
                    </div>
                    <StatusPill status={booking.status} />
                  </div>
                  <p className="text-sm font-medium text-stone-700 truncate">{booking.customer_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-stone-500 truncate">
                      {booking.services?.name || booking.service_name || 'Service'}
                      {booking.specialist_name ? ` · ${booking.specialist_name}` : ''}
                    </p>
                    {canSeeRevenue && priceOf(booking) > 0 && (
                      <span className="text-xs font-semibold text-[#1A1714] tabular-nums shrink-0">
                        {formatPrice(priceOf(booking))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateBookingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchBookings();
        }}
      />
    </div>
  );
}
