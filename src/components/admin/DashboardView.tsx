import { useEffect, useState, useRef } from 'react';
import { Calendar, DollarSign, Users, TrendingUp, Plus, ChevronDown, ArrowUpRight } from 'lucide-react';
import CreateBookingModal from './CreateBookingModal';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { adminAuth } from '../../lib/adminAuth';
import PermissionGuard from './PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

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
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[#008374] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-black mb-2">Dashboard</h1>
          <p className="text-gray-600 text-lg">Welcome back! Here's what's happening today</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <Button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="bg-[#008374] hover:bg-[#006b5e] text-white shadow-lg"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            <span>Quick Actions</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
          {showCreateDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
              <div className="py-2">
                <button
                  onClick={() => handleCreateAction('create-booking')}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-[#008374] hover:bg-opacity-5 transition-colors flex items-center space-x-3 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#008374] bg-opacity-10 flex items-center justify-center group-hover:bg-opacity-20 transition-all">
                    <Calendar className="w-5 h-5 text-[#008374]" />
                  </div>
                  <div>
                    <div className="font-medium text-black">Create Booking</div>
                    <div className="text-xs text-gray-500">Schedule new appointment</div>
                  </div>
                </button>
                <button
                  onClick={() => handleCreateAction('customers')}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-[#008374] hover:bg-opacity-5 transition-colors flex items-center space-x-3 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#89BA16] bg-opacity-10 flex items-center justify-center group-hover:bg-opacity-20 transition-all">
                    <Users className="w-5 h-5 text-[#89BA16]" />
                  </div>
                  <div>
                    <div className="font-medium text-black">Add Customer</div>
                    <div className="text-xs text-gray-500">Create new client profile</div>
                  </div>
                </button>
                <button
                  onClick={() => handleCreateAction('gift-cards')}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-[#008374] hover:bg-opacity-5 transition-colors flex items-center space-x-3 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500 bg-opacity-10 flex items-center justify-center group-hover:bg-opacity-20 transition-all">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="font-medium text-black">Issue Gift Card</div>
                    <div className="text-xs text-gray-500">Generate new gift card</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer bg-gradient-to-br from-[#008374] to-[#006b5e]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 rounded-2xl bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <div className="flex items-center space-x-1 text-white text-opacity-80">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">+12%</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold text-white">{stats.totalBookings}</p>
              <p className="text-sm text-white text-opacity-80 font-medium">Total Bookings</p>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
        </Card>

        <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer bg-gradient-to-br from-[#89BA16] to-[#729610]">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 rounded-2xl bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold text-white">{stats.todayBookings}</p>
              <p className="text-sm text-white text-opacity-80 font-medium">Today's Bookings</p>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
        </Card>

        {hasPermission('view_revenue') && (
          <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer bg-gradient-to-br from-amber-500 to-amber-600">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
                <div className="flex items-center space-x-1 text-white text-opacity-80">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">+8%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-sm text-white text-opacity-80 font-medium">Total Revenue</p>
              </div>
            </CardContent>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
          </Card>
        )}

        <Card className="relative overflow-hidden border-none shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer bg-gradient-to-br from-blue-500 to-blue-600">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="w-14 h-14 rounded-2xl bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-bold text-white">{stats.totalCustomers}</p>
              <p className="text-sm text-white text-opacity-80 font-medium">Unique Customers</p>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
        </Card>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-black">Recent Bookings</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Latest appointments and reservations</p>
            </div>
            <Button
              variant="outline"
              className="border-[#008374] text-[#008374] hover:bg-[#008374] hover:text-white"
              onClick={() => onNavigate('bookings')}
            >
              View All
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Calendar className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-sm font-medium">No bookings yet</p>
                        <p className="text-xs mt-1">Create your first booking to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 text-sm font-medium text-black">{booking.customer_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{booking.service_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(booking.booking_date)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">{booking.start_time}</td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={booking.status === 'confirmed' ? 'default' : booking.status === 'pending' ? 'secondary' : 'destructive'}
                          className={`${
                            booking.status === 'confirmed'
                              ? 'bg-green-100 text-green-700 hover:bg-green-100'
                              : booking.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                              : 'bg-red-100 text-red-700 hover:bg-red-100'
                          } rounded-full`}
                        >
                          {booking.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
