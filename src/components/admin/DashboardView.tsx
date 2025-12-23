import { useEffect, useState, useRef } from 'react';
import { Calendar, DollarSign, Users, TrendingUp, Plus, ChevronDown, ArrowUpRight, AlertCircle, RefreshCw, Gift, CheckCircle, Sparkles } from 'lucide-react';
import CreateBookingModal from './CreateBookingModal';
import { supabase } from '../../lib/supabase';
import { executeWithTimeout, getUserFriendlyErrorMessage } from '../../lib/queryUtils';
import { usePermissions } from '../../hooks/usePermissions';
import { adminAuth } from '../../lib/adminAuth';
import PermissionGuard from './PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useCurrency } from '../../lib/currencyContext';

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
  const { formatPrice } = useCurrency();
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    todayBookings: 0,
    totalRevenue: 0,
    totalCustomers: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showCreateBookingModal, setShowCreateBookingModal] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [giftCardStatus, setGiftCardStatus] = useState<string | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    fetchDashboardData();
    setTimeout(() => setIsLoaded(true), 100);

    return () => {
      mountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
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
    if (action === 'create-booking') {
      setShowCreateBookingModal(true);
    } else {
      onNavigate(action);
    }
  };

  const checkGiftCardBalance = async () => {
    if (!giftCardCode.trim()) {
      setGiftCardError('Please enter a gift card code');
      return;
    }

    setCheckingGiftCard(true);
    setGiftCardError(null);
    setGiftCardBalance(null);
    setGiftCardStatus(null);

    const businessId = adminUser?.business_id;
    if (!businessId) {
      setGiftCardError('Unable to determine your business');
      setCheckingGiftCard(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('gift_cards')
        .select('current_balance_cents, status, expires_at')
        .eq('business_id', businessId)
        .eq('code', giftCardCode.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setGiftCardError('Gift card not found');
      } else {
        if (data.status === 'redeemed') {
          setGiftCardError('This gift card has already been fully redeemed');
        } else if (data.status === 'expired') {
          setGiftCardError('This gift card has expired');
        } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setGiftCardError('This gift card has expired');
        } else {
          setGiftCardBalance(data.current_balance_cents / 100);
          setGiftCardStatus(data.status);
        }
      }
    } catch (err) {
      console.error('Error checking gift card:', err);
      setGiftCardError('Failed to check gift card balance');
    } finally {
      setCheckingGiftCard(false);
    }
  };

  const fetchDashboardData = async () => {
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
      const result = await executeWithTimeout(
        supabase
          .from('bookings')
          .select(`
            *,
            services (name),
            service_durations (price_cents)
          `)
          .eq('business_id', businessId),
        { timeout: 8000, retries: 2 }
      );

      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      if (result.error) {
        throw result.error;
      }

      if (result.data && mountedRef.current) {
        const bookings = result.data;
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
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      if (mountedRef.current) {
        setError(getUserFriendlyErrorMessage(error));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    }
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#008374]/20 border-t-[#008374] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's what's happening today</p>
          </div>
        </div>

        <Card className="border-red-200 bg-red-50/50 backdrop-blur-sm">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Bookings',
      value: stats.totalBookings,
      subtitle: '+12% from last month',
      icon: Calendar,
      color: 'from-[#008374] to-[#00a894]',
      delay: 0
    },
    {
      title: "Today's Bookings",
      value: stats.todayBookings,
      subtitle: 'Active appointments today',
      icon: Calendar,
      color: 'from-[#89BA16] to-[#a5d621]',
      delay: 100
    },
    ...(hasPermission('view_revenue') ? [{
      title: 'Total Revenue',
      value: formatPrice(stats.totalRevenue),
      subtitle: '+8% from last month',
      icon: DollarSign,
      color: 'from-purple-500 to-purple-600',
      delay: 200
    }] : []),
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      subtitle: 'Unique client profiles',
      icon: Users,
      color: 'from-orange-400 to-orange-500',
      delay: 300
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className={`flex items-center justify-between transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <Badge className="bg-[#008374]/10 text-[#008374] hover:bg-[#008374]/20 border-0">
              <Sparkles className="w-3 h-3 mr-1" />
              Live
            </Badge>
          </div>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today</p>
        </div>
        <div className="relative z-50" ref={dropdownRef}>
          <Button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25"
          >
            <Plus className="h-4 w-4" />
            New
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform duration-200 ${showCreateDropdown ? 'rotate-180' : ''}`} />
          </Button>
          {showCreateDropdown && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-white backdrop-blur-xl p-2 shadow-2xl z-[100] animate-fade-in-down">
              <button
                onClick={() => handleCreateAction('create-booking')}
                className="relative flex w-full items-center rounded-lg px-3 py-2.5 text-sm hover:bg-[#008374]/10 transition-colors"
              >
                <Calendar className="mr-3 h-4 w-4 text-[#008374]" />
                <span>Create Booking</span>
              </button>
              <button
                onClick={() => handleCreateAction('customers')}
                className="relative flex w-full items-center rounded-lg px-3 py-2.5 text-sm hover:bg-[#008374]/10 transition-colors"
              >
                <Users className="mr-3 h-4 w-4 text-[#008374]" />
                <span>Add Customer</span>
              </button>
              <button
                onClick={() => handleCreateAction('gift-cards')}
                className="relative flex w-full items-center rounded-lg px-3 py-2.5 text-sm hover:bg-[#008374]/10 transition-colors"
              >
                <DollarSign className="mr-3 h-4 w-4 text-[#008374]" />
                <span>Issue Gift Card</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card 
            key={stat.title}
            glass
            className={`group hover-lift overflow-hidden transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionDelay: `${stat.delay}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-[#008374] transition-colors" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground">
                  {stat.subtitle.includes('+') ? (
                    <span className="text-[#008374] font-medium">{stat.subtitle}</span>
                  ) : stat.subtitle}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gift Card Check */}
      <Card glass className={`transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#008374] to-[#00a894]">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Check Gift Card Balance</CardTitle>
              <p className="text-sm text-muted-foreground">Enter a gift card code to check its balance</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && checkGiftCardBalance()}
                placeholder="Enter gift card code"
                className="flex-1 px-4 py-3 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008374]/20 focus:border-[#008374] transition-all uppercase placeholder:normal-case"
              />
              <Button
                onClick={checkGiftCardBalance}
                disabled={checkingGiftCard || !giftCardCode.trim()}
                className="bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25 px-6"
              >
                {checkingGiftCard ? 'Checking...' : 'Check Balance'}
              </Button>
            </div>

            {giftCardError && (
              <div className="flex items-center gap-3 p-4 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl text-red-700 animate-fade-in">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{giftCardError}</p>
              </div>
            )}

            {giftCardBalance !== null && giftCardStatus && (
              <div className="flex items-center gap-3 p-4 bg-green-50/80 backdrop-blur-sm border border-green-200 rounded-xl animate-fade-in">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-900">Gift Card Active</p>
                  <p className="text-sm text-green-700 mt-0.5">
                    Current Balance: <span className="font-bold text-lg">{formatPrice(giftCardBalance * 100)}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('gift-cards')}
                  className="border-green-300 hover:bg-green-100 text-green-700"
                >
                  View Details
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <Card glass className={`transform transition-all duration-500 delay-300 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#89BA16] to-[#a5d621]">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Recent Bookings</CardTitle>
                <p className="text-sm text-muted-foreground">View and manage your latest appointments</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('bookings')}
              className="hover:bg-[#008374]/10 hover:border-[#008374] hover:text-[#008374]"
            >
              View All
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-gray-100 rounded-2xl mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground">No bookings yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first booking to get started</p>
                <Button
                  onClick={() => setShowCreateBookingModal(true)}
                  variant="outline"
                  className="hover:bg-[#008374]/10 hover:border-[#008374] hover:text-[#008374]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Booking
                </Button>
              </div>
            ) : (
              recentBookings.map((booking, index) => (
                <div 
                  key={booking.id} 
                  className="flex items-center p-4 rounded-xl bg-white/50 hover:bg-white/80 transition-all duration-200 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {booking.customer_name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {booking.service_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatDate(booking.booking_date)}</p>
                      <p className="text-sm text-muted-foreground">{booking.start_time}</p>
                    </div>
                    <Badge
                      className={`capitalize rounded-full px-3 ${
                        booking.status === 'confirmed' 
                          ? 'bg-[#008374]/10 text-[#008374] border-[#008374]/20' 
                          : booking.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-700 border-yellow-200' 
                            : 'bg-red-100 text-red-700 border-red-200'
                      }`}
                      variant="outline"
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
