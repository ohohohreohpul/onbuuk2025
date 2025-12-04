import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Edit2, Trash2, AlertCircle, DollarSign } from 'lucide-react';
import { emailService } from '../../lib/emailService';
import { useTenant } from '../../lib/tenantContext';

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  booking_date: string;
  start_time: string;
  status: string;
  is_pair_booking: boolean;
  notes: string | null;
  no_show: boolean;
  no_show_marked_at: string | null;
  service: { name: string; no_show_fee: number };
  duration: { duration_minutes: number; price_cents: number };
  specialist: { name: string } | null;
}

export default function BookingsView() {
  const { businessId } = useTenant();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [searchTerm, statusFilter, bookings]);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name, no_show_fee),
        duration:service_durations(duration_minutes, price_cents),
        specialist:specialists(name)
      `)
      .order('booking_date', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
    } else {
      setBookings(data as any);
    }
    setLoading(false);
  };

  const filterBookings = () => {
    let filtered = bookings;

    if (searchTerm) {
      filtered = filtered.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.customer_email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    setFilteredBookings(filtered);
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    if (!businessId) return;

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (!error) {
      await emailService.sendStatusChangeNotification({
        businessId,
        customerEmail: booking.customer_email,
        customerName: booking.customer_name,
        status: newStatus,
        serviceName: booking.service.name,
        bookingDate: formatDate(booking.booking_date),
        startTime: booking.start_time,
      });

      fetchBookings();
    }
  };

  const deleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (!error) {
      fetchBookings();
    }
  };

  const markAsNoShow = async (booking: Booking) => {
    if (!confirm(`Mark this appointment as a no-show? ${booking.service.no_show_fee > 0 ? `A fee of ${formatPrice(booking.service.no_show_fee)} will be charged.` : ''}`)) return;

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        no_show: true,
        no_show_marked_at: new Date().toISOString(),
        status: 'cancelled'
      })
      .eq('id', booking.id);

    if (bookingError) {
      alert('Failed to mark as no-show: ' + bookingError.message);
      return;
    }

    if (booking.service.no_show_fee > 0) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', booking.customer_email)
        .maybeSingle();

      const { error: feeError } = await supabase
        .from('no_show_fees')
        .insert({
          booking_id: booking.id,
          customer_id: customer?.id || null,
          amount: booking.service.no_show_fee,
          reason: 'no_show',
          notes: `No-show for ${booking.service.name} on ${formatDate(booking.booking_date)} at ${booking.start_time}`
        });

      if (feeError) {
        console.error('Failed to create no-show fee:', feeError);
      }
    }

    fetchBookings();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light text-stone-800 mb-2">Bookings</h1>
        <p className="text-stone-600">Manage all customer bookings</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search by customer name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 appearance-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-stone-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Specialist
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-stone-500">
                    No bookings found
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-800 font-medium">{booking.customer_name}</div>
                      <div className="text-xs text-stone-500">{booking.customer_email}</div>
                      <div className="text-xs text-stone-500">{booking.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-800">{booking.service.name}</div>
                      <div className="text-xs text-stone-500">
                        {booking.duration.duration_minutes} min
                        {booking.is_pair_booking && ' • Couples'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-800">{formatDate(booking.booking_date)}</div>
                      <div className="text-xs text-stone-500">{booking.start_time}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {booking.specialist?.name || 'Anyone'}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-800">
                      {formatPrice(booking.duration.price_cents)}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={booking.status}
                        onChange={(e) => updateBookingStatus(booking.id, e.target.value)}
                        className={`px-3 py-1.5 text-xs rounded-full border-0 focus:ring-2 focus:ring-stone-400 cursor-pointer font-medium ${
                          booking.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : booking.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : booking.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {!booking.no_show && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                          <button
                            onClick={() => markAsNoShow(booking)}
                            className="text-orange-600 hover:text-orange-800 transition-colors"
                            title="Mark as no-show"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        )}
                        {booking.no_show && (
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">
                            No-show
                          </span>
                        )}
                        <button
                          onClick={() => deleteBooking(booking.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-stone-600">
        Showing {filteredBookings.length} of {bookings.length} bookings
      </div>
    </div>
  );
}
