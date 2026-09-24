import { useState, useEffect } from 'react';
import { Gift, Search, Check, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import {
  ADMIN_INPUT,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_SURFACE,
} from './adminUi';

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  card_type?: 'value' | 'service_pass';
  service_pass_name?: string | null;
  original_visits?: number | null;
  remaining_visits?: number | null;
  status: string;
  expires_at: string | null;
  service?: { name: string } | null;
  duration?: { duration_minutes: number; price_cents: number } | null;
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
      .select('*, service:services(name), duration:service_durations(duration_minutes, price_cents)')
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

    if (card.card_type === 'service_pass' ? (card.remaining_visits || 0) <= 0 : card.current_balance_cents <= 0) {
      setError(card.card_type === 'service_pass' ? 'This service pass has no visits remaining' : 'This gift card has a zero balance');
      setSearchingCard(false);
      return;
    }

    setFoundCard(card);
    setRedeemAmount(card.card_type === 'service_pass' ? '' : ((card.current_balance_cents / 100).toFixed(2)));
    setSearchingCard(false);
  };

  const handleRedeemGiftCard = async () => {
    if (!foundCard) return;

    if (foundCard.card_type === 'service_pass') {
      setRedeeming(true);
      setError('');
      const { data, error: redemptionError } = await supabase.rpc('redeem_service_pass_at_pos', {
        p_code: foundCard.code,
      });

      if (redemptionError) {
        setError(redemptionError.message || 'Failed to redeem service pass');
      } else {
        setMessage(`Visit redeemed. ${data?.remainingVisits || 0} ${data?.remainingVisits === 1 ? 'visit remains' : 'visits remain'}.`);
        setGiftCardCode('');
        setFoundCard(null);
        setTimeout(() => setMessage(''), 5000);
      }
      setRedeeming(false);
      return;
    }

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
      setError('Failed to update booking');
    } else {
      setError('');
      setMessage('Booking marked as paid!');
      loadPendingBookings();
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">Checkout desk</h2>
          <p className="mt-1 text-sm text-stone-500">Redeem value cards or service-pass visits and close pending in-person payments.</p>
        </div>
        <span className="text-xs text-stone-400">{pendingBookings.length} pending payment{pendingBookings.length === 1 ? '' : 's'}</span>
      </div>

      {(message || error) && (
        <div role="status" className={`rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-200/80 bg-red-50/70 text-red-700' : 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'}`}>
          {error || message}
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className={`${ADMIN_SEGMENTED_CONTROL} min-w-max`}>
          <button
            type="button"
            onClick={() => setActiveTab('gift_cards')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'gift_cards' ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            <Gift className="h-4 w-4" strokeWidth={1.75} />
            Redeem card or pass
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'bookings' ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            <DollarSign className="h-4 w-4" strokeWidth={1.75} />
            Pending payments
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${activeTab === 'bookings' ? 'bg-white/[0.15]' : 'bg-stone-900/[0.05]'}`}>
              {pendingBookings.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'gift_cards' && (
        <section className={`${ADMIN_SURFACE} p-6`}>
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]">
              <Gift className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-[#1A1714]">Find a card or pass</h3>
              <p className="mt-1 text-sm text-stone-500">Scan a code or enter it exactly as shown to check its live balance or remaining visits.</p>
            </div>
          </div>

          <form onSubmit={handleSearchGiftCard}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">Card or pass code</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value)}
                    className={`${ADMIN_INPUT} flex-1 uppercase`}
                    placeholder="GC-XXXX-XXXX-XXXX"
                    required
                  />
                  <button
                    type="submit"
                    disabled={searchingCard}
                    className={ADMIN_PRIMARY_BUTTON}
                  >
                    <Search className="h-4 w-4" />
                    {searchingCard ? 'Searching…' : 'Find card'}
                  </button>
              </div>
            </label>
          </form>

          {foundCard && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-200/70 bg-emerald-50/60">
              <div className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-700/70">{foundCard.card_type === 'service_pass' ? 'Service entitlement' : 'Available balance'}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-950">
                    {foundCard.card_type === 'service_pass'
                      ? `${foundCard.remaining_visits || 0} ${(foundCard.remaining_visits || 0) === 1 ? 'visit' : 'visits'} left`
                      : formatAmount(foundCard.current_balance_cents / 100)}
                  </p>
                  {foundCard.card_type === 'service_pass' && (
                    <p className="mt-1 text-sm text-emerald-800">{foundCard.service_pass_name} · {foundCard.service?.name} · {foundCard.duration?.duration_minutes} min</p>
                  )}
                  <p className="mt-1 font-mono text-xs text-emerald-700/70">{foundCard.code}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.65] text-emerald-700 ring-1 ring-emerald-900/[0.05]">
                  <Check className="h-6 w-6" />
                </div>
              </div>

              <div className="border-t border-emerald-200/70 bg-white/30 p-5">
                {foundCard.card_type === 'service_pass' ? (
                  <div>
                    <p className="text-sm leading-6 text-emerald-900">Redeem one visit for the service shown above. This records the current service value but never turns the pass into cash.</p>
                    <button type="button" onClick={handleRedeemGiftCard} disabled={redeeming} className={`${ADMIN_PRIMARY_BUTTON} mt-4 w-full`}>
                      {redeeming ? 'Processing…' : 'Redeem one visit'}
                    </button>
                  </div>
                ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-emerald-950">Amount to redeem ({currencySymbol})</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      className={`${ADMIN_INPUT} flex-1`}
                      step="0.01"
                      min="0.01"
                      max={(foundCard.current_balance_cents / 100).toFixed(2)}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleRedeemGiftCard}
                      disabled={redeeming}
                      className={ADMIN_PRIMARY_BUTTON}
                    >
                      {redeeming ? 'Processing…' : 'Redeem value'}
                    </button>
                  </div>
                  <span className="mt-1.5 block text-xs text-emerald-700/70">Maximum {formatAmount(foundCard.current_balance_cents / 100)}</span>
                </label>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'bookings' && (
        <section className={`${ADMIN_SURFACE} overflow-hidden`}>
          <div className="border-b border-stone-200/70 px-5 py-4">
            <h3 className="font-semibold text-[#1A1714]">Bookings awaiting payment</h3>
            <p className="mt-1 text-xs text-stone-400">Use this after collecting payment at the venue.</p>
          </div>
          {loadingBookings ? (
            <div className="animate-pulse space-y-3 p-5">
              {[0, 1, 2].map((row) => <div key={row} className="h-14 rounded-xl bg-stone-900/[0.035]" />)}
            </div>
          ) : pendingBookings.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Check className="mx-auto h-6 w-6 text-emerald-500" strokeWidth={1.75} />
              <p className="mt-3 text-sm font-medium text-stone-600">Nothing waiting for payment</p>
              <p className="mt-1 text-xs text-stone-400">New pay-at-venue bookings appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-stone-900/[0.025]">
                  <tr>
                    {['Date & time', 'Customer', 'Service', 'Amount', ''].map((heading) => (
                      <th key={heading} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 last:text-right">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/60">
                  {pendingBookings.map((booking) => (
                    <tr key={booking.id} className="transition-colors hover:bg-white/60">
                      <td className="px-5 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-[#1A1714]">
                            {new Date(booking.booking_date).toLocaleDateString()}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-400">{booking.start_time}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-[#1A1714]">{booking.customer_name}</p>
                          <p className="mt-0.5 text-xs text-stone-400">{booking.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-[#1A1714]">{booking.service.name}</p>
                          <p className="mt-0.5 text-xs text-stone-400">{booking.duration.duration_minutes} min</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[#1A1714]">
                          {formatAmount(booking.duration.price_cents / 100)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleMarkAsPaid(booking.id)}
                          className={ADMIN_PRIMARY_BUTTON}
                        >
                          <Check className="h-4 w-4" /> Mark paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
