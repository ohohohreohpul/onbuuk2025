import { useState, useEffect } from 'react';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import { supabase } from '../../lib/supabase';
import { Calendar, User, LogOut, Mail, Phone, Lock, X, Award, Gift } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  customer_name: string;
  service: {
    name: string;
    category: string;
  };
  specialist: {
    name: string;
  };
  duration: {
    duration_minutes: number;
    price_cents: number;
  };
}

interface LoyaltyPoints {
  points_balance: number;
  points_earned_total: number;
  points_redeemed_total: number;
}

interface LoyaltyTransaction {
  id: string;
  points: number;
  transaction_type: string;
  description: string;
  created_at: string;
}

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  status: string;
  expires_at: string | null;
}

export function CustomerPortal() {
  const { customer, loading, signOut, updateProfile, updatePassword } = useCustomerAuth();
  const { businessId } = useTenant();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'bookings' | 'rewards' | 'giftcards' | 'profile'>('bookings');
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  // Loyalty points state
  const [loyaltyPoints, setLoyaltyPoints] = useState<LoyaltyPoints | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);

  // Gift cards state
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [giftCardEnabled, setGiftCardEnabled] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [claimingCard, setClaimingCard] = useState(false);

  // Edit form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone || '');
      loadBookings();
      loadLoyaltyPoints();
      loadGiftCards();
      checkLoyaltyEnabled();
      checkGiftCardEnabled();
    }
  }, [customer]);

  const checkLoyaltyEnabled = async () => {
    const { data } = await supabase
      .from('loyalty_settings')
      .select('enabled')
      .eq('business_id', businessId)
      .maybeSingle();

    setLoyaltyEnabled(data?.enabled || false);
  };

  const checkGiftCardEnabled = async () => {
    const { data } = await supabase
      .from('gift_card_settings')
      .select('enabled')
      .eq('business_id', businessId)
      .maybeSingle();

    setGiftCardEnabled(data?.enabled || false);
  };

  const loadLoyaltyPoints = async () => {
    if (!customer) return;

    const { data: pointsData } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (pointsData) {
      setLoyaltyPoints(pointsData);
    }

    const { data: transactionsData } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (transactionsData) {
      setLoyaltyTransactions(transactionsData);
    }
  };

  const loadGiftCards = async () => {
    if (!customer) return;

    const { data } = await supabase
      .from('customer_gift_cards')
      .select(`
        gift_card_id,
        gift_cards (
          id,
          code,
          original_value_cents,
          current_balance_cents,
          status,
          expires_at
        )
      `)
      .eq('customer_id', customer.id);

    if (data) {
      const cards = data
        .map((item: any) => item.gift_cards)
        .filter((card: any) => card !== null);
      setGiftCards(cards);
    }
  };

  const handleClaimGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !claimCode.trim()) return;

    setClaimingCard(true);
    setError('');
    setMessage('');

    const { data: card, error: cardError } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('code', claimCode.toUpperCase().trim())
      .eq('business_id', businessId)
      .maybeSingle();

    if (cardError || !card) {
      setError('Gift card not found');
      setClaimingCard(false);
      return;
    }

    if (card.status !== 'active') {
      setError('This gift card is no longer active');
      setClaimingCard(false);
      return;
    }

    const { error: claimError } = await supabase
      .from('customer_gift_cards')
      .insert({
        customer_id: customer.id,
        gift_card_id: card.id,
      });

    if (claimError) {
      if (claimError.code === '23505') {
        setError('You have already claimed this gift card');
      } else {
        setError('Failed to claim gift card');
      }
    } else {
      setMessage('Gift card claimed successfully!');
      setClaimCode('');
      loadGiftCards();
      setTimeout(() => setMessage(''), 3000);
    }

    setClaimingCard(false);
  };

  const loadBookings = async () => {
    if (!customer) return;

    setLoadingBookings(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name, category),
        specialist:specialists(name),
        duration:service_durations(duration_minutes, price_cents)
      `)
      .eq('customer_email', customer.email)
      .eq('business_id', businessId)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error loading bookings:', error);
    } else {
      setBookings(data || []);
    }
    setLoadingBookings(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await updateProfile({ name, phone });
      setMessage('Profile updated successfully!');
      setEditMode(false);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await updatePassword(newPassword);
      setMessage('Password changed successfully!');
      setChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (error) {
      alert('Failed to cancel booking');
    } else {
      loadBookings();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please log in</h2>
          <p className="text-gray-600">You need to be logged in to view this page.</p>
        </div>
      </div>
    );
  }

  const upcomingBookings = bookings.filter(b => {
    const bookingDate = new Date(b.booking_date + 'T' + b.start_time);
    return bookingDate > new Date() && b.status !== 'cancelled';
  });

  const pastBookings = bookings.filter(b => {
    const bookingDate = new Date(b.booking_date + 'T' + b.start_time);
    return bookingDate <= new Date() || b.status === 'cancelled';
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
              <p className="text-gray-600 mt-1">{customer.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-6 border-b">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`pb-2 px-1 font-medium transition-colors ${
                activeTab === 'bookings'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Bookings
            </button>
            {loyaltyEnabled && (
              <button
                onClick={() => setActiveTab('rewards')}
                className={`pb-2 px-1 font-medium transition-colors ${
                  activeTab === 'rewards'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Rewards
                </div>
              </button>
            )}
            {giftCardEnabled && (
              <button
                onClick={() => setActiveTab('giftcards')}
                className={`pb-2 px-1 font-medium transition-colors ${
                  activeTab === 'giftcards'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Gift Cards
                </div>
              </button>
            )}
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-2 px-1 font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Profile Settings
            </button>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Content */}
        {activeTab === 'bookings' ? (
          <div className="space-y-6">
            {/* Upcoming Bookings */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Upcoming Appointments</h2>
              {loadingBookings ? (
                <p className="text-gray-600">Loading...</p>
              ) : upcomingBookings.length === 0 ? (
                <p className="text-gray-600">No upcoming appointments</p>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => (
                    <div key={booking.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-blue-600 font-medium mb-2">
                            <Calendar className="w-4 h-4" />
                            {new Date(booking.booking_date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                          <p className="text-lg font-semibold text-gray-900">{booking.service.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {booking.start_time} • {booking.duration.duration_minutes} minutes • ${(booking.duration.price_cents / 100).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-600">with {booking.specialist.name}</p>
                        </div>
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Bookings */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Past Appointments</h2>
              {pastBookings.length === 0 ? (
                <p className="text-gray-600">No past appointments</p>
              ) : (
                <div className="space-y-3">
                  {pastBookings.slice(0, 10).map((booking) => (
                    <div key={booking.id} className="border rounded-lg p-4 opacity-75">
                      <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
                        <Calendar className="w-4 h-4" />
                        {new Date(booking.booking_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {booking.status === 'cancelled' && (
                          <span className="text-red-600 font-medium">(Cancelled)</span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">{booking.service.name}</p>
                      <p className="text-sm text-gray-600">with {booking.specialist.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Your Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{customer.total_bookings}</p>
                  <p className="text-sm text-gray-600 mt-1">Total Visits</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    ${(customer.total_spent_cents / 100).toFixed(0)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Total Spent</p>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'rewards' ? (
          <div className="space-y-6">
            {/* Points Balance */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-2">Your Rewards Balance</p>
                  <p className="text-5xl font-bold">{loyaltyPoints?.points_balance || 0}</p>
                  <p className="text-blue-100 text-sm mt-2">points</p>
                </div>
                <Award className="w-16 h-16 text-blue-200" />
              </div>
            </div>

            {/* Points Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{loyaltyPoints?.points_earned_total || 0}</p>
                    <p className="text-sm text-gray-600">Total Earned</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Gift className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{loyaltyPoints?.points_redeemed_total || 0}</p>
                    <p className="text-sm text-gray-600">Total Redeemed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Points History */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Points History</h2>
              <div className="space-y-3">
                {loyaltyTransactions.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">No transactions yet</p>
                ) : (
                  loyaltyTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(transaction.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className={`text-lg font-bold ${transaction.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {transaction.points > 0 ? '+' : ''}{transaction.points}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'giftcards' ? (
          <div className="space-y-6">
            {/* Claim Gift Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Claim Gift Card</h2>
              <form onSubmit={handleClaimGiftCard} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Gift Card Code
                  </label>
                  <input
                    type="text"
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    placeholder="GC-XXXX-XXXX-XXXX"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={claimingCard}
                  className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {claimingCard ? 'Claiming...' : 'Claim Gift Card'}
                </button>
              </form>
            </div>

            {/* My Gift Cards */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">My Gift Cards</h2>
              {giftCards.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No gift cards yet</p>
              ) : (
                <div className="space-y-3">
                  {giftCards.map((card) => (
                    <div key={card.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-mono text-sm font-medium text-gray-700">{card.code}</p>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          card.status === 'active' ? 'bg-green-100 text-green-700' :
                          card.status === 'fully_redeemed' ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {card.status === 'fully_redeemed' ? 'Used' : card.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            ${(card.current_balance_cents / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Original: ${(card.original_value_cents / 100).toFixed(2)}
                          </p>
                        </div>
                        {card.expires_at && (
                          <p className="text-xs text-gray-500">
                            Expires: {new Date(card.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Profile Information</h2>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              {editMode ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="email"
                        value={customer.email}
                        disabled
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false);
                        setName(customer.name);
                        setPhone(customer.phone || '');
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-gray-700">
                    <User className="w-5 h-5 text-gray-400" />
                    <span>{customer.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span>{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span>{customer.phone || 'Not provided'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Change Password</h2>
                {!changePassword && (
                  <button
                    onClick={() => setChangePassword(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Change Password
                  </button>
                )}
              </div>

              {changePassword ? (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Update Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangePassword(false);
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-gray-600">Click "Change Password" to update your password</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
