import { useEffect, useState, useRef } from 'react';
import { Calendar, DollarSign, Users, TrendingUp, Plus, ChevronDown } from 'lucide-react';
import CreateBookingModal from './CreateBookingModal';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { adminAuth } from '../../lib/adminAuth';
import PermissionGuard from './PermissionGuard';

interface DashboardStats {
  totalBookings: number;
  todayBookings: number;
  totalRevenue: number;
  totalCustomers: number;
}

interface RecentBooking {
  id: string;
  customer_name: string;
  booking_date: string;
  start_time: string;
  status: string;
  service_name: string;
}

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const adminUser = adminAuth.getCurrentUser();
  const { hasPermission } = usePermissions(adminUser?.id || null);
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    todayBookings: 0,
    totalRevenue: 0,
    totalCustomers: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDashboardData();
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
    if (action === 'create-booking') {
      setShowCreateBookingModal(true);
    } else {
      onNavigate(action);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          *,
          services (name),
          service_durations (price_cents)
        `);

      if (bookings) {
        const today = new Date().toISOString().split('T')[0];
        const todayCount = bookings.filter(b => b.booking_date === today).length;

        const revenue = bookings.reduce((sum, booking: any) => {
          return sum + (booking.service_durations?.price_cents || 0);
        }, 0);

        const uniqueCustomers = new Set(bookings.map(b => b.customer_email)).size;

        setStats({
          totalBookings: bookings.length,
          todayBookings: todayCount,
          totalRevenue: revenue,
          totalCustomers: uniqueCustomers,
        });

        const recent = bookings
          .slice(0, 5)
          .map((b: any) => ({
            id: b.id,
            customer_name: b.customer_name,
            booking_date: b.booking_date,
            start_time: b.start_time,
            status: b.status,
            service_name: b.services?.name || 'Unknown',
          }));

        setRecentBookings(recent);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light text-stone-800 mb-2">Dashboard</h1>
          <p className="text-stone-600">Overview of your massage studio</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="flex items-center space-x-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {showCreateDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-lg shadow-lg z-50">
              <div className="py-1">
                <button
                  onClick={() => handleCreateAction('create-booking')}
                  className="w-full text-left px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Create Booking</span>
                </button>
                <button
                  onClick={() => handleCreateAction('customers')}
                  className="w-full text-left px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                >
                  <Users className="w-4 h-4" />
                  <span>Create Customer</span>
                </button>
                <button
                  onClick={() => handleCreateAction('gift-cards')}
                  className="w-full text-left px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors flex items-center space-x-3"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Issue Gift Card</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-light text-stone-800">{stats.totalBookings}</p>
            <p className="text-sm text-stone-600">Total Bookings</p>
          </div>
        </div>

        <div className="bg-white p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-light text-stone-800">{stats.todayBookings}</p>
            <p className="text-sm text-stone-600">Today's Bookings</p>
          </div>
        </div>

        {hasPermission('view_revenue') && (
          <div className="bg-white p-6 border border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-amber-600" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-light text-stone-800">{formatCurrency(stats.totalRevenue)}</p>
              <p className="text-sm text-stone-600">Total Revenue</p>
            </div>
          </div>
        )}

        <div className="bg-white p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-light text-stone-800">{stats.totalCustomers}</p>
            <p className="text-sm text-stone-600">Unique Customers</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-stone-200">
        <div className="p-6 border-b border-stone-200">
          <h2 className="text-xl font-light text-stone-800">Recent Bookings</h2>
        </div>
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-stone-500">
                    No bookings yet
                  </td>
                </tr>
              ) : (
                recentBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4 text-sm text-stone-800">{booking.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{booking.service_name}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{formatDate(booking.booking_date)}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{booking.start_time}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        booking.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
