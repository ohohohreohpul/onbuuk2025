import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Check, Search, AlertCircle, CreditCard, Ban, RotateCcw, Loader2, HelpCircle, X } from 'lucide-react';
import { adminAuth } from '../../lib/adminAuth';
import NoShowAnalytics from './noshow/NoShowAnalytics';
import UnbilledNoShowRows, { type UnbilledNoShowRow } from './noshow/UnbilledNoShowRows';
import { createUnpaidNoShowFees } from '../../lib/noShowFees';
import { useCurrency } from '../../lib/currencyContext';
import {
  ADMIN_ICON_TILE,
  ADMIN_INPUT,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_STATUS_PILL,
  ADMIN_SURFACE,
  ADMIN_SURFACE_INTERACTIVE,
  ADMIN_TERTIARY_BUTTON,
} from './adminUi';

type FeeResolution = 'unpaid' | 'paid' | 'waived';

const GUIDE_DISMISSED_KEY = 'zenno.noShowFees.guideDismissed';

const readGuideDismissed = (): boolean => {
  try {
    return localStorage.getItem(GUIDE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const writeGuideDismissed = (isDismissed: boolean) => {
  try {
    if (isDismissed) localStorage.setItem(GUIDE_DISMISSED_KEY, '1');
    else localStorage.removeItem(GUIDE_DISMISSED_KEY);
  } catch {
    // Storage can be unavailable (private mode); the guide simply reappears next visit.
  }
};

interface NoShowFee {
  id: string;
  booking_id: string;
  customer_id: string | null;
  amount: number;
  reason: string;
  charged_at: string;
  paid: boolean;
  paid_at: string | null;
  resolution_status: FeeResolution;
  resolved_at: string | null;
  resolution_note: string | null;
  notes: string | null;
  customer: { name: string; email: string } | null;
  booking: {
    business_id: string;
    stripe_payment_method_id: string | null;
    no_show_fee_charged: boolean;
  } | null;
}

export default function NoShowFeesView() {
  const { formatPrice } = useCurrency();
  const adminUser = adminAuth.getCurrentUser();
  const businessId = adminUser?.business_id || null;
  const [fees, setFees] = useState<NoShowFee[]>([]);
  const [filteredFees, setFilteredFees] = useState<NoShowFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FeeResolution>('unpaid');
  const [activeFeeId, setActiveFeeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [unbilled, setUnbilled] = useState<UnbilledNoShowRow[]>([]);
  const [isGuideDismissed, setIsGuideDismissed] = useState(readGuideDismissed);

  const toggleGuide = (isDismissed: boolean) => {
    setIsGuideDismissed(isDismissed);
    writeGuideDismissed(isDismissed);
  };

  useEffect(() => {
    fetchFees();
  }, [businessId]);

  useEffect(() => {
    filterFees();
  }, [searchTerm, statusFilter, fees]);

  const fetchFees = async () => {
    if (!businessId) {
      setError('Unable to determine your business. Please try logging in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    await fetchUnbilled(businessId);

    const { data, error: fetchError } = await supabase
      .from('no_show_fees')
      .select(`
        *,
        customer:customers(name, email),
        booking:bookings!inner(business_id, stripe_payment_method_id, no_show_fee_charged)
      `)
      .eq('booking.business_id', businessId)
      .order('charged_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching no-show fees:', fetchError);
      setError('Failed to load no-show fees.');
    } else {
      const normalizedFees = (data || []).map((row) => ({
        ...row,
        customer: Array.isArray(row.customer) ? row.customer[0] || null : row.customer,
        booking: Array.isArray(row.booking) ? row.booking[0] || null : row.booking,
      })) as NoShowFee[];
      setFees(normalizedFees);
    }
    setLoading(false);
  };

  // No-shows are the source of truth: any no-show whose service carries a fee
  // but has no fee record yet is shown here too, so this list matches the
  // repeat no-show analytics above.
  const fetchUnbilled = async (targetBusinessId: string) => {
    const { data, error: unbilledError } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_email, booking_date, start_time, service:services(name, no_show_fee), fees:no_show_fees(id)')
      .eq('business_id', targetBusinessId)
      .eq('no_show', true)
      .order('booking_date', { ascending: false });

    if (unbilledError) {
      console.error('Error fetching unbilled no-shows:', unbilledError);
      setUnbilled([]);
      return;
    }

    type Row = {
      id: string; customer_name: string; customer_email: string; booking_date: string; start_time: string;
      service: { name: string; no_show_fee: number | null } | { name: string; no_show_fee: number | null }[] | null;
      fees: { id: string } | { id: string }[] | null;
    };
    const first = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);
    const rows = ((data || []) as unknown as Row[])
      .filter((row) => !first(row.fees) && Number(first(row.service)?.no_show_fee || 0) > 0)
      .map((row) => ({
        id: row.id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        booking_date: row.booking_date,
        start_time: row.start_time,
        serviceName: first(row.service)?.name || 'appointment',
        feeCents: Number(first(row.service)?.no_show_fee || 0),
      }));
    setUnbilled(rows);
  };

  const addFee = async (row: UnbilledNoShowRow) => {
    if (!businessId) return;
    setActiveFeeId(row.id);
    setNotice(null);
    const { error: addError } = await createUnpaidNoShowFees(businessId, [row]);
    if (addError) {
      setNotice({ tone: 'error', text: addError });
    } else {
      setNotice({ tone: 'success', text: `Fee added for ${row.customer_name}. Now charge the card, mark it paid, or waive it.` });
      await fetchFees();
    }
    setActiveFeeId(null);
  };

  const filterFees = () => {
    let filtered = fees;

    if (searchTerm) {
      filtered = filtered.filter(
        (f) =>
          f.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.customer?.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((f) => f.resolution_status === statusFilter);
    }

    setFilteredFees(filtered);
  };

  const markAsPaid = async (feeId: string) => {
    setActiveFeeId(feeId);
    setNotice(null);
    const resolvedAt = new Date().toISOString();
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: true,
        paid_at: resolvedAt,
        resolution_status: 'paid',
        resolved_at: resolvedAt,
        resolution_note: 'Marked paid manually',
      })
      .eq('id', feeId);

    if (!error) {
      setNotice({ tone: 'success', text: 'Fee marked paid. It has left the Action Centre.' });
      await fetchFees();
    } else {
      setNotice({ tone: 'error', text: 'We could not mark this fee paid. Please try again.' });
    }
    setActiveFeeId(null);
  };

  const reopenFee = async (feeId: string) => {
    setActiveFeeId(feeId);
    setNotice(null);
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: false,
        paid_at: null,
        resolution_status: 'unpaid',
        resolved_at: null,
        resolution_note: null,
      })
      .eq('id', feeId);

    if (!error) {
      setNotice({ tone: 'warning', text: 'Fee reopened and returned to the Action Centre.' });
      await fetchFees();
    } else {
      setNotice({ tone: 'error', text: 'We could not reopen this fee. Please try again.' });
    }
    setActiveFeeId(null);
  };

  const waiveFee = async (fee: NoShowFee) => {
    if (!confirm(`Waive ${formatPrice(fee.amount)} for ${fee.customer?.name || 'this customer'}? The fee will be closed without recording payment.`)) return;

    setActiveFeeId(fee.id);
    setNotice(null);
    const resolvedAt = new Date().toISOString();
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: false,
        paid_at: null,
        resolution_status: 'waived',
        resolved_at: resolvedAt,
        resolution_note: 'Waived by staff',
      })
      .eq('id', fee.id);

    if (!error) {
      setNotice({ tone: 'success', text: 'Fee waived. It has left the Action Centre.' });
      await fetchFees();
    } else {
      setNotice({ tone: 'error', text: 'We could not waive this fee. Please try again.' });
    }
    setActiveFeeId(null);
  };

  const chargeSavedCard = async (fee: NoShowFee) => {
    if (!fee.booking?.stripe_payment_method_id) {
      setNotice({ tone: 'warning', text: 'This booking has no saved card. Record an external payment or waive the fee.' });
      return;
    }

    if (!confirm(`Charge ${formatPrice(fee.amount)} to the saved card for ${fee.customer?.name || 'this customer'}?`)) return;

    setActiveFeeId(fee.id);
    setNotice(null);
    const { data, error } = await supabase.functions.invoke('charge-no-show-fee', {
      body: { booking_id: fee.booking_id },
    });

    if (!error && data?.charged) {
      setNotice({ tone: 'success', text: `Card charged ${formatPrice(Number(data.amount) || fee.amount)}. The fee is resolved.` });
      await fetchFees();
      setActiveFeeId(null);
      return;
    }

    const reasonMessages: Record<string, string> = {
      no_card_on_file: 'This booking has no saved card. Record an external payment or waive the fee.',
      payments_not_connected: 'Connect Stripe in Settings → Payments before charging saved cards.',
      no_fee_configured: 'This service no longer has a no-show fee configured.',
      already_charged: 'This booking was already charged. Refreshing its fee status now.',
      charge_failed: 'The saved card could not be charged. Ask the customer to pay another way or waive the fee.',
    };
    setNotice({
      tone: data?.reason === 'charge_failed' || error ? 'error' : 'warning',
      text: reasonMessages[data?.reason] || error?.message || 'The saved card could not be charged.',
    });
    await fetchFees();
    setActiveFeeId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };



  const getTotalUnbilled = () => unbilled.reduce((sum, row) => sum + row.feeCents, 0);

  const getTotalUnpaid = () => {
    return fees.filter((f) => f.resolution_status === 'unpaid').reduce((sum, f) => sum + f.amount, 0) + getTotalUnbilled();
  };

  const getTotalPaid = () => {
    return fees.filter((f) => f.resolution_status === 'paid').reduce((sum, f) => sum + f.amount, 0);
  };

  const getTotalWaived = () => {
    return fees.filter((f) => f.resolution_status === 'waived').reduce((sum, f) => sum + f.amount, 0);
  };

  const showUnbilled = statusFilter === 'all' || statusFilter === 'unpaid';
  const visibleUnbilled = searchTerm
    ? unbilled.filter((row) =>
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.customer_email.toLowerCase().includes(searchTerm.toLowerCase()))
    : unbilled;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50/70 p-4 text-red-700">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">No-Show Fees</h1>
          <p className="text-sm text-stone-500">Collect, record, or waive each fee. Resolved fees leave the Action Centre automatically.</p>
        </div>
        {isGuideDismissed && (
          <button type="button" onClick={() => toggleGuide(false)} className={`${ADMIN_TERTIARY_BUTTON} text-xs`}>
            <HelpCircle className="h-3.5 w-3.5" />
            How does this work?
          </button>
        )}
      </div>

      {!isGuideDismissed && (
        <section className="relative grid gap-3 rounded-2xl border border-white/70 bg-white/[0.64] p-4 pr-12 shadow-[0_2px_18px_rgba(26,23,20,0.045)] backdrop-blur-xl md:grid-cols-[auto_1fr]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-900/[0.06] text-stone-700">
            <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1A1714]">How to clear an unpaid fee</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">
              <span className="font-medium text-stone-700">Charge card</span> charges the card the customer saved at booking through Stripe.{' '}
              <span className="font-medium text-stone-700">Mark paid</span> only records money you already received (cash, bank transfer, terminal) — it doesn't charge anyone.{' '}
              <span className="font-medium text-stone-700">Waive</span> closes the fee without collecting it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleGuide(true)}
            aria-label="Close guide"
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </section>
      )}

      {notice && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200/80 bg-emerald-50/75 text-emerald-800'
              : notice.tone === 'warning'
                ? 'border-amber-200/80 bg-amber-50/75 text-amber-800'
                : 'border-red-200/80 bg-red-50/75 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      <NoShowAnalytics businessId={businessId!} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[13px] font-medium text-stone-500">Outstanding</span>
            <div className={ADMIN_ICON_TILE}>
              <DollarSign className="h-5 w-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(getTotalUnpaid())}</div>
          {unbilled.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">Includes {formatPrice(getTotalUnbilled())} not billed yet</p>
          )}
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[13px] font-medium text-stone-500">Collected</span>
            <div className={ADMIN_ICON_TILE}>
              <Check className="h-5 w-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(getTotalPaid())}</div>
        </div>

        <div className={`${ADMIN_SURFACE_INTERACTIVE} p-5`}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-[13px] font-medium text-stone-500">Waived</span>
            <div className={ADMIN_ICON_TILE}>
              <DollarSign className="h-5 w-5" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(getTotalWaived())}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search by customer name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${ADMIN_INPUT} pl-10`}
          />
        </div>
        <div className={ADMIN_SEGMENTED_CONTROL}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'unpaid'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            Unpaid
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'paid'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            Paid
          </button>
          <button
            onClick={() => setStatusFilter('waived')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === 'waived'
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            Waived
          </button>
        </div>
      </div>

      <div className={`${ADMIN_SURFACE} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50/60 border-b border-stone-200/70">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Billed on
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {showUnbilled && (
                <UnbilledNoShowRows
                  rows={visibleUnbilled}
                  activeId={activeFeeId}
                  formatPrice={formatPrice}
                  formatDate={formatDate}
                  onAddFee={addFee}
                />
              )}
              {filteredFees.length === 0 && !(showUnbilled && visibleUnbilled.length > 0) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-stone-500">
                    No fees found
                  </td>
                </tr>
              ) : filteredFees.length === 0 ? null : (
                filteredFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-800 font-medium">
                        {fee.customer?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-stone-500">{fee.customer?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`${ADMIN_STATUS_PILL} ${
                          fee.reason === 'no_show'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {fee.reason === 'no_show' ? 'No-Show' : 'Late Cancel'}
                      </span>
                      {fee.notes && (
                        <div className="text-xs text-stone-500 mt-1">{fee.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-800 font-medium">
                      {formatPrice(fee.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500">
                      {formatDate(fee.charged_at)}
                    </td>
                    <td className="px-6 py-4">
                      {fee.resolution_status === 'paid' ? (
                        <div>
                          <span className={`${ADMIN_STATUS_PILL} bg-emerald-50 text-emerald-700`}>
                            Paid
                          </span>
                          {fee.paid_at && (
                            <div className="text-xs text-stone-500 mt-1">
                              {formatDate(fee.paid_at)}
                            </div>
                          )}
                        </div>
                      ) : fee.resolution_status === 'waived' ? (
                        <div>
                          <span className={`${ADMIN_STATUS_PILL} bg-stone-100 text-stone-600`}>
                            Waived
                          </span>
                          {fee.resolved_at && (
                            <div className="mt-1 text-xs text-stone-500">{formatDate(fee.resolved_at)}</div>
                          )}
                        </div>
                      ) : (
                        <span className={`${ADMIN_STATUS_PILL} bg-amber-50 text-amber-700`}>
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="min-w-[310px] px-6 py-4">
                      {activeFeeId === fee.id ? (
                        <div className="flex items-center gap-2 text-sm text-stone-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating fee…
                        </div>
                      ) : fee.resolution_status !== 'unpaid' ? (
                        <button
                          type="button"
                          onClick={() => reopenFee(fee.id)}
                          className={ADMIN_TERTIARY_BUTTON}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reopen
                        </button>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {fee.booking?.stripe_payment_method_id && !fee.booking.no_show_fee_charged ? (
                              <button
                                type="button"
                                onClick={() => chargeSavedCard(fee)}
                                className={`${ADMIN_PRIMARY_BUTTON} px-3 py-2 text-xs`}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Charge card
                              </button>
                            ) : (
                              <span className="rounded-lg bg-stone-100 px-2.5 py-2 text-xs text-stone-500">
                                {fee.booking?.no_show_fee_charged ? 'Charge recorded' : 'No saved card'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => markAsPaid(fee.id)}
                              className={`${ADMIN_SECONDARY_BUTTON} px-3 py-2 text-xs`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Mark paid
                            </button>
                            <button
                              type="button"
                              onClick={() => waiveFee(fee)}
                              className={`${ADMIN_TERTIARY_BUTTON} px-2.5 py-2 text-xs`}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Waive
                            </button>
                          </div>
                          {!fee.booking?.stripe_payment_method_id && !fee.booking?.no_show_fee_charged && (
                            <p className="mt-2 text-[11px] leading-4 text-stone-400">No card was saved, so collect it yourself, then “Mark paid”.</p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-stone-400">
        Showing {filteredFees.length + (showUnbilled ? visibleUnbilled.length : 0)} of {fees.length + unbilled.length} no-shows
      </div>
    </div>
  );
}
