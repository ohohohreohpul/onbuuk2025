import { useState, useEffect } from 'react';
import { CreditCard, Gift, Search, Check, X, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  status: string;
  expires_at: string | null;
}

interface PendingBooking {
  id: string;
  booking_date: string;
  start_time: string;
  customer_name: string;
  customer_email: string;
  payment_status: string;
  service: {
    name: string;
  };
  duration: {
    price_cents: number;
    duration_minutes: number;
  };
}

export function POSView() {
  const { businessId } = useTenant();
  const { formatAmount, currencySymbol } = useCurrency();
  const [activeTab, setActiveTab] = useState<'gift_cards' | 'bookings'>('gift_cards');

  // Gift card state
  const [giftCardCode, setGiftCardCode] = useState('');
  const [searchingCard, setSearchingCard] = useState(false);
  const [foundCard, setFoundCard] = useState<GiftCard | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Pending bookings state
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    loadPendingBookings();
  }, [businessId]);

  const loadPendingBookings = async () => {
    setLoadingBookings(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name),
        duration:service_durations(price_cents, duration_minutes)
      `)
      .eq('business_id', businessId)
      .eq('payment_status', 'pending')
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (!error && data) {
      setPendingBookings(data);
    }
    setLoadingBookings(false);
  };

  const handleSearchGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCardCode.trim()) return;

    setSearchingCard(true);
    setError('');
    setMessage('');
    setFoundCard(null);

    const { data: card, error: cardError } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('code', giftCardCode.toUpperCase().trim())
      .eq('business_id', businessId)
      .maybeSingle();

    if (cardError || !card) {
      setError('Gift card not found');
      setSearchingCard(false);
      return;
    }

    if (card.status !== 'active') {
      setError(`This gift card is ${card.status}  and cannot be used`);
      setSearchingCard(false);
      return;
    }

    if (card.current_balance_cents <= 0) {
      setError('This gift card has a zero balance');
      setSearchingCard(false);
      return;
    }

    setFoundCard(card);
    setRedeemAmount(((card.current_balance_cents / 100).toFixed(2)));
    setSearchingCard(false);
  };

  const handleRedeemGiftCard = async () => {
    if (!foundCard) return;

    const amountCents = Math.round(parseFloat(redeemAmount) * 100);

    if (amountCents <= 0 || amountCents > foundCard.current_balance_cents) {
      setError(`Amount must be between ${formatAmount(0.01)} and ${formatAmount(foundCard.current_balance_cents / 100)}`);
      return;
    }

    setRedeeming(true);
    setError('');

    try {
      const newBalance = foundCard.current_balance_cents - amountCents;
      const newStatus = newBalance === 0 ? 'fully_redeemed' : 'active';

      // Update gift card balance
      const { error: updateError } = await supabase
        .from('gift_cards')
        .update({
          current_balance_cents: newBalance,
          status: newStatus,
        })
        .eq('id', foundCard.id);

      if (updateError) throw updateError;

      // Record transaction
      await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: foundCard.id,
          amount_cents: -amountCents,
          transaction_type: 'redemption',
          description: `Redeemed ${formatAmount(amountCents / 100)} at POS`,
        });

      setMessage(`Successfully redeemed ${formatAmount(amountCents / 100)} from gift card!`);
      setGiftCardCode('');
      setFoundCard(null);
      setRedeemAmount('');
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to redeem gift card');
    } finally {
      setRedeeming(false);
    }
  };

  const handleMarkAsPaid = async (bookingId: string) => {
    if (!confirm('Mark this booking as paid?')) return;

    const { error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
      })
      .eq('id', bookingId);

    if (error) {
      alert('Failed to update booking');
    } else {
      setMessage('Booking marked as paid!');
      loadPendingBookings();
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Point of Sale (POS)</h2>
        <p className="text-gray-600 mt-1">
          Process gift card redemptions and manage walk-in payments
        </p>
      </div>

      {(message || error) && (
        <div className={`p-4 rounded-lg ${error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {error || message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('gift_cards')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'gift_cards'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Redeem Gift Card
            </div>
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'bookings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Pending Payments ({pendingBookings.length})
            </div>
          </button>
        </div>
      </div>

      {/* Gift Card Redemption */}
      {activeTab === 'gift_cards' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Scan or Enter Gift Card Code</h3>
            <form onSubmit={handleSearchGiftCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gift Card Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                    placeholder="GC-XXXX-XXXX-XXXX"
                    required
                  />
                  <button
                    type="submit"
                    disabled={searchingCard}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Search className="w-5 h-5" />
                    {searchingCard ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </form>

            {foundCard && (
              <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 mb-1">Gift Card Found</p>
                    <p className="text-2xl font-bold text-green-900">
                      {formatAmount(foundCard.current_balance_cents / 100)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Code: {foundCard.code}
                    </p>
                  </div>
                  <Check className="w-12 h-12 text-green-600" />
                </div>

                <div className="pt-4 border-t border-green-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Redeem ({currencySymbol})
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      step="0.01"
                      min="0.01"
                      max={(foundCard.current_balance_cents / 100).toFixed(2)}
                      required
                    />
                    <button
                      onClick={handleRedeemGiftCard}
                      disabled={redeeming}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {redeeming ? 'Processing...' : 'Redeem'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Max: {formatAmount(foundCard.current_balance_cents / 100)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Bookings */}
      {activeTab === 'bookings' && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Bookings Awaiting Payment</h3>
          {loadingBookings ? (
            <p className="text-gray-600">Loading...</p>
          ) : pendingBookings.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No pending payments</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date & Time</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Service</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBookings.map((booking) => (
                    <tr key={booking.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">
                            {new Date(booking.booking_date).toLocaleDateString()}
                          </p>
                          <p className="text-gray-600">{booking.start_time}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{booking.customer_name}</p>
                          <p className="text-gray-600">{booking.customer_email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{booking.service.name}</p>
                          <p className="text-gray-600">{booking.duration.duration_minutes} min</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-lg font-bold text-gray-900">
                          {formatAmount(booking.duration.price_cents / 100)}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleMarkAsPaid(booking.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Mark as Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
