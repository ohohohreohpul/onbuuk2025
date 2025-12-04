import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, Clock, Euro, Plus } from 'lucide-react';
import CreateBookingModal from './CreateBookingModal';

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
  total_price_cents: number;
  status: string;
  is_pair_booking: boolean;
}

interface BookingStats {
  todayBookings: number;
  weekRevenue: number;
  monthBookings: number;
  upcomingToday: Booking[];
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats>({
    todayBookings: 0,
    weekRevenue: 0,
    monthBookings: 0,
    upcomingToday: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<string | undefined>();

  useEffect(() => {
    fetchBookings();
    fetchStats();
  }, [currentDate]);

  const fetchBookings = async () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .gte('booking_date', startOfMonth.toISOString().split('T')[0])
      .lte('booking_date', endOfMonth.toISOString().split('T')[0])
      .order('booking_date', { ascending: true });

    if (!error && data) {
      setBookings(data);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const [todayData, weekData, monthData] = await Promise.all([
      supabase.from('bookings').select('*').eq('booking_date', today),
      supabase.from('bookings').select('*').gte('booking_date', startOfWeek.toISOString().split('T')[0]),
      supabase.from('bookings').select('*').gte('booking_date', startOfMonth.toISOString().split('T')[0])
    ]);

    const upcomingToday = todayData.data?.filter(b => {
      const bookingTime = new Date(`${b.booking_date}T${b.start_time}`);
      return bookingTime > new Date();
    }) || [];

    setStats({
      todayBookings: todayData.data?.length || 0,
      weekRevenue: weekData.data?.reduce((sum, b) => sum + b.total_price_cents, 0) || 0,
      monthBookings: monthData.data?.length || 0,
      upcomingToday: upcomingToday.slice(0, 5)
    });
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getBookingsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.filter(b => b.booking_date === dateStr);
  };

  const handleDateClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    setDayBookings(getBookingsForDay(day));
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const formatPrice = (cents: number) => `€${(cents / 100).toFixed(2)}`;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const days = getDaysInMonth();
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-stone-800 mb-2">Calendar</h1>
          <p className="text-stone-600">View and manage bookings</p>
        </div>
        <button
          onClick={() => {
            setCreateModalDate(undefined);
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Create Booking</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-stone-600 text-sm">Today's Bookings</span>
            <CalendarIcon className="w-5 h-5 text-stone-400" />
          </div>
          <p className="text-3xl font-light text-stone-800">{stats.todayBookings}</p>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-stone-600 text-sm">This Week Revenue</span>
            <Euro className="w-5 h-5 text-stone-400" />
          </div>
          <p className="text-3xl font-light text-stone-800">{formatPrice(stats.weekRevenue)}</p>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-stone-600 text-sm">This Month</span>
            <TrendingUp className="w-5 h-5 text-stone-400" />
          </div>
          <p className="text-3xl font-light text-stone-800">{stats.monthBookings}</p>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-stone-600 text-sm">Upcoming Today</span>
            <Clock className="w-5 h-5 text-stone-400" />
          </div>
          <p className="text-3xl font-light text-stone-800">{stats.upcomingToday.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-medium text-stone-800">{monthYear}</h2>
            <div className="flex space-x-2">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-stone-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-stone-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-stone-600 pb-2">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dayBookings = getBookingsForDay(day);
              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
              const isSelected = selectedDate?.toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={`aspect-square p-2 border transition-all ${
                    isSelected
                      ? 'bg-stone-800 text-white border-stone-800'
                      : isToday
                      ? 'bg-stone-100 border-stone-300'
                      : 'border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <div className="text-sm font-medium">{day}</div>
                  {dayBookings.length > 0 && (
                    <div className={`text-xs mt-1 ${isSelected ? 'text-white' : 'text-stone-600'}`}>
                      {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <h2 className="text-xl font-medium text-stone-800 mb-4">
            {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Upcoming Today'}
          </h2>

          {(selectedDate ? dayBookings : stats.upcomingToday).length === 0 ? (
            <p className="text-stone-500 text-sm">No bookings</p>
          ) : (
            <div className="space-y-4">
              {(selectedDate ? dayBookings : stats.upcomingToday).map(booking => (
                <div key={booking.id} className="border-l-4 border-stone-800 pl-4 py-2">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium text-stone-800">{formatTime(booking.start_time)}</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      booking.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : booking.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-stone-100 text-stone-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                  <p className="text-sm text-stone-800">{booking.customer_name}</p>
                  <p className="text-xs text-stone-600">{booking.service_name}</p>
                  <p className="text-xs text-stone-500">{booking.duration_minutes} min • {formatPrice(booking.total_price_cents)}</p>
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
          fetchStats();
        }}
        preselectedDate={createModalDate}
      />
    </div>
  );
}
