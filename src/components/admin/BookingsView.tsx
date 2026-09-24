import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { deriveBookingState, formatStartTime, type BookingState, type FeeResolution } from './bookings/bookingState';
import BookingRowActions from './bookings/BookingRowActions';
import { createUnpaidNoShowFees } from '../../lib/noShowFees';
import { ADMIN_INPUT, ADMIN_SEGMENTED_CONTROL, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE, ADMIN_STATUS_PILL, ADMIN_SURFACE } from './adminUi';

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
  fees: { resolution_status: FeeResolution } | { resolution_status: FeeResolution }[] | null;
}

type ViewFilter = 'needs-action' | 'upcoming' | 'past' | 'cancelled' | 'all';

interface BookingsViewProps {
  onNavigate?: (view: string) => void;
}

const FILTERS: { id: ViewFilter; label: string }[] = [
  { id: 'needs-action', label: 'Needs action' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled & no-shows' },
  { id: 'all', label: 'All' },
];

const TONE_CLASSES: Record<BookingState['tone'], string> = {
  amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70',
  stone: 'bg-stone-100 text-stone-700 ring-1 ring-stone-200/70',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200/70',
  muted: 'bg-stone-50 text-stone-500 ring-1 ring-stone-200/60',
};

const DOT_CLASSES: Record<BookingState['tone'], string> = {
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  stone: 'bg-stone-500',
  red: 'bg-red-500',
  muted: 'bg-stone-300',
};

const feeResolutionOf = (booking: Booking): FeeResolution | null => {
  const fee = Array.isArray(booking.fees) ? booking.fees[0] : booking.fees;
  return fee?.resolution_status ?? null;
};

const stateOf = (booking: Booking): BookingState =>
  deriveBookingState({
    status: booking.status,
    no_show: booking.no_show,
    booking_date: booking.booking_date,
    start_time: booking.start_time,
    hasNoShowFee: (booking.service?.no_show_fee || 0) > 0,
    feeResolution: feeResolutionOf(booking),
  });

const matchesFilter = (filter: ViewFilter, state: BookingState): boolean => {
  if (filter === 'all') return true;
  if (filter === 'needs-action') return state.needsAction;
  if (filter === 'upcoming') return state.stage === 'upcoming' || state.stage === 'needs-confirmation';
  if (filter === 'past') return state.stage === 'completed' || state.stage === 'awaiting-checkout';
  return state.stage === 'cancelled' || state.stage === 'no-show';
};

export default function BookingsView({ onNavigate }: BookingsViewProps) {
  const { formatPrice } = useCurrency();
  const { businessId } = useTenant();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('needs-action');
  const [hasChosenFilter, setHasChosenFilter] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [businessId]);

  useEffect(() => {
    filterBookings();
  }, [searchTerm, viewFilter, bookings]);

  const fetchBookings = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name, no_show_fee),
        duration:service_durations(duration_minutes, price_cents),
        specialist:specialists(name),
        fees:no_show_fees(resolution_status)
      `)
      .eq('business_id', businessId)
      .order('booking_date', { ascending: false });

    if (error) {
      console.error('Error fetching bookings:', error);
    } else {
      const rows = (data || []) as unknown as Booking[];
      setBookings(rows);
      if (!hasChosenFilter && !rows.some((booking) => stateOf(booking).needsAction)) {
        setViewFilter('all');
      }
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

    filtered = filtered.filter((b) => matchesFilter(viewFilter, stateOf(b)));

    setFilteredBookings(filtered);
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    if (!businessId) return;

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    setBusyId(bookingId);
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      alert('Could not update this booking. Please try again.');
    } else {
      await fetchBookings();
    }
    setBusyId(null);
  };

  const cancelBooking = (booking: Booking) => {
    if (!confirm(`Cancel ${booking.customer_name}'s booking on ${formatDate(booking.booking_date)}?`)) return;
    updateBookingStatus(booking.id, 'cancelled');
  };

  const deleteBooking = async (bookingId: string) => {
    if (!confirm('Delete this booking permanently? It will disappear from reports and history. To keep a record, cancel it instead.')) return;

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (!error) {
      fetchBookings();
    }
  };

  const markAsNoShow = async (booking: Booking) => {
    if (!confirm(`Mark ${booking.customer_name} as a no-show? ${booking.service.no_show_fee > 0 ? `We'll try to charge the ${formatPrice(booking.service.no_show_fee)} fee to their saved card. If there isn't one, the fee goes to No-Show Fees for you to resolve.` : ''}`)) return;
    setBusyId(booking.id);

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
      setBusyId(null);
      return;
    }

    // Treatwell model: if the customer left a card on file at checkout, charge the fee.
    if (booking.service.no_show_fee > 0) {
      try {
        const { data: chargeResult, error: chargeError } = await supabase.functions.invoke('charge-no-show-fee', {
          body: { booking_id: booking.id },
        });

        if (!chargeError && chargeResult?.charged) {
          alert(`No-show marked. Charged ${formatPrice(chargeResult.amount)} to the card on file.`);
          await fetchBookings();
          setBusyId(null);
          return;
        }
      } catch (e) {
        console.error('Card charge attempt failed:', e);
      }
    }

    if (booking.service.no_show_fee > 0) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', booking.customer_email)
        .eq('business_id', businessId!)
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

    await fetchBookings();
    setBusyId(null);
  };

  const addFee = async (booking: Booking) => {
    if (!businessId) return;
    setBusyId(booking.id);
    const { error } = await createUnpaidNoShowFees(businessId, [{
      id: booking.id,
      customer_email: booking.customer_email,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      serviceName: booking.service.name,
      feeCents: booking.service.no_show_fee,
    }]);
    setBusyId(null);
    if (error) {
      alert(error);
      return;
    }
    onNavigate?.('fees');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const countFor = (filter: ViewFilter) => bookings.filter((b) => matchesFilter(filter, stateOf(b))).length;

  const chooseFilter = (filter: ViewFilter) => {
    setHasChosenFilter(true);
    setViewFilter(filter);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const needsActionCount = countFor('needs-action');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">Bookings</h1>
        <p className="text-sm text-stone-500">
          {needsActionCount > 0
            ? `${needsActionCount} booking${needsActionCount === 1 ? ' needs' : 's need'} a decision. Each row shows its next step; everything else is under ⋯.`
            : 'Nothing needs a decision right now. Each row shows its next step when one is due.'}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className={`${ADMIN_SEGMENTED_CONTROL} overflow-x-auto`} role="tablist" aria-label="Filter bookings">
          {FILTERS.map((filter) => {
            const count = countFor(filter.id);
            const isActive = viewFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => chooseFilter(filter.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${isActive ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE}`}
              >
                {filter.label}
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${isActive ? 'bg-white/20' : filter.id === 'needs-action' && count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-stone-900/[0.06]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search by customer name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${ADMIN_INPUT} pl-10`}
          />
        </div>
      </div>

      <div className={`${ADMIN_SURFACE} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-stone-200/70 bg-[#F9F7F4]/80">
              <tr>
                {['Customer', 'Appointment', 'Price', 'Status'].map((heading) => (
                  <th key={heading} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                    {heading}
                  </th>
                ))}
                <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-stone-500">Next step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-stone-500">
                    {viewFilter === 'needs-action' ? 'You’re all caught up — nothing needs a decision.' : 'No bookings found'}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking) => {
                  const state = stateOf(booking);
                  const isClosed = state.stage === 'cancelled';
                  return (
                    <tr key={booking.id} className={`transition-colors hover:bg-stone-50/70 ${state.needsAction ? 'bg-amber-50/25' : ''}`}>
                      <td className="px-5 py-4">
                        <div className={`text-sm font-semibold ${isClosed ? 'text-stone-500' : 'text-[#1A1714]'}`}>{booking.customer_name}</div>
                        <div className="mt-0.5 text-xs text-stone-500">{booking.customer_email}</div>
                        <div className="text-xs text-stone-400">{booking.customer_phone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className={`text-sm font-medium ${isClosed ? 'text-stone-500 line-through decoration-stone-300' : 'text-[#1A1714]'}`}>
                          {formatDate(booking.booking_date)} · {formatStartTime(booking.start_time)}
                        </div>
                        <div className="mt-0.5 text-xs text-stone-500">
                          {booking.service.name} · {booking.duration.duration_minutes} min · {booking.specialist?.name || 'Any specialist'}
                          {booking.is_pair_booking && (
                            <span className="ml-2 rounded-full bg-stone-900/[0.06] px-2 py-0.5 text-[11px] font-medium text-stone-700">Couples</span>
                          )}
                        </div>
                      </td>
                      <td className={`px-5 py-4 text-sm font-semibold tabular-nums ${isClosed ? 'text-stone-400' : 'text-[#1A1714]'}`}>
                        {formatPrice(booking.duration.price_cents)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`${ADMIN_STATUS_PILL} ${TONE_CLASSES[state.tone]}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[state.tone]}`} />
                          {state.label}
                        </span>
                        <div className="mt-1 text-[11px] text-stone-400">{state.hint}</div>
                      </td>
                      <td className="px-5 py-4">
                        <BookingRowActions
                          state={state}
                          isBusy={busyId === booking.id}
                          onConfirm={() => updateBookingStatus(booking.id, 'confirmed')}
                          onComplete={() => updateBookingStatus(booking.id, 'completed')}
                          onNoShow={() => markAsNoShow(booking)}
                          onResolveFee={() => onNavigate?.('fees')}
                          onAddFee={() => addFee(booking)}
                          onCancel={() => cancelBooking(booking)}
                          onRestore={() => updateBookingStatus(booking.id, 'confirmed')}
                          onDelete={() => deleteBooking(booking.id)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-stone-400">
        Showing {filteredBookings.length} of {bookings.length} bookings
      </div>
    </div>
  );
}
