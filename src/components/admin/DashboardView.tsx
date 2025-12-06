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
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today</p>
        </div>
        <div className="relative" ref={dropdownRef}>
          <Button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
          >
            <Plus className="h-4 w-4" />
            New
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
          {showCreateDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover p-1 shadow-md z-50">
              <button
                onClick={() => handleCreateAction('create-booking')}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Calendar className="mr-2 h-4 w-4" />
                <span>Create Booking</span>
              </button>
              <button
                onClick={() => handleCreateAction('customers')}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Add Customer</span>
              </button>
              <button
                onClick={() => handleCreateAction('gift-cards')}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                <span>Issue Gift Card</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-[#008374]">+12%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Bookings
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayBookings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active appointments today
            </p>
          </CardContent>
        </Card>

        {hasPermission('view_revenue') && (
          <Card className="rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-[#008374]">+8%</span> from last month
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Unique client profiles
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Bookings</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">View and manage your latest appointments</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('bookings')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="font-medium text-sm">No bookings yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Create your first booking to get started</p>
              </div>
            ) : (
              recentBookings.map((booking) => (
                <div key={booking.id} className="flex items-center">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium leading-none">
                      {booking.customer_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {booking.service_name}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatDate(booking.booking_date)}</p>
                      <p className="text-sm text-muted-foreground">{booking.start_time}</p>
                    </div>
                    <Badge
                      variant={booking.status === 'confirmed' ? 'default' : booking.status === 'pending' ? 'secondary' : 'destructive'}
                      className="capitalize"
                    >
                      {booking.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
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
