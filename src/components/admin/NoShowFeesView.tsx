import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Check, X, Search } from 'lucide-react';

interface NoShowFee {
  id: string;
  booking_id: string;
  customer_id: string | null;
  amount: number;
  reason: string;
  charged_at: string;
  paid: boolean;
  paid_at: string | null;
  notes: string | null;
  customer: { name: string; email: string } | null;
}

export default function NoShowFeesView() {
  const [fees, setFees] = useState<NoShowFee[]>([]);
  const [filteredFees, setFilteredFees] = useState<NoShowFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    fetchFees();
  }, []);

  useEffect(() => {
    filterFees();
  }, [searchTerm, statusFilter, fees]);

  const fetchFees = async () => {
    const { data, error } = await supabase
      .from('no_show_fees')
      .select(`
        *,
        customer:customers(name, email)
      `)
      .order('charged_at', { ascending: false });

    if (error) {
      console.error('Error fetching no-show fees:', error);
    } else {
      setFees(data as any);
    }
    setLoading(false);
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

    if (statusFilter === 'paid') {
      filtered = filtered.filter((f) => f.paid);
    } else if (statusFilter === 'unpaid') {
      filtered = filtered.filter((f) => !f.paid);
    }

    setFilteredFees(filtered);
  };

  const markAsPaid = async (feeId: string) => {
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq('id', feeId);

    if (!error) {
      fetchFees();
    }
  };

  const markAsUnpaid = async (feeId: string) => {
    const { error } = await supabase
      .from('no_show_fees')
      .update({
        paid: false,
        paid_at: null,
      })
      .eq('id', feeId);

    if (!error) {
      fetchFees();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const getTotalUnpaid = () => {
    return fees.filter((f) => !f.paid).reduce((sum, f) => sum + f.amount, 0);
  };

  const getTotalPaid = () => {
    return fees.filter((f) => f.paid).reduce((sum, f) => sum + f.amount, 0);
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
        <h1 className="text-3xl font-light text-stone-800 mb-2">No-Show Fees</h1>
        <p className="text-stone-600">Track and manage no-show and late cancellation fees</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600">Total Unpaid</span>
            <DollarSign className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-light text-stone-800">{formatPrice(getTotalUnpaid())}</div>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600">Total Paid</span>
            <Check className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-light text-stone-800">{formatPrice(getTotalPaid())}</div>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stone-600">Total Fees</span>
            <DollarSign className="w-5 h-5 text-stone-600" />
          </div>
          <div className="text-2xl font-light text-stone-800">{fees.length}</div>
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
            className="w-full pl-10 pr-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
          />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 border transition-colors ${
              statusFilter === 'all'
                ? 'border-stone-800 bg-stone-800 text-white'
                : 'border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-4 py-2 border transition-colors ${
              statusFilter === 'unpaid'
                ? 'border-orange-600 bg-orange-600 text-white'
                : 'border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            Unpaid
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-2 border transition-colors ${
              statusFilter === 'paid'
                ? 'border-green-600 bg-green-600 text-white'
                : 'border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            Paid
          </button>
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
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Charged Date
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
              {filteredFees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-stone-500">
                    No fees found
                  </td>
                </tr>
              ) : (
                filteredFees.map((fee) => (
                  <tr key={fee.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4">
                      <div className="text-sm text-stone-800 font-medium">
                        {fee.customer?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-stone-500">{fee.customer?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                          fee.reason === 'no_show'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
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
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {formatDate(fee.charged_at)}
                    </td>
                    <td className="px-6 py-4">
                      {fee.paid ? (
                        <div>
                          <span className="inline-flex px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-800">
                            Paid
                          </span>
                          {fee.paid_at && (
                            <div className="text-xs text-stone-500 mt-1">
                              {formatDate(fee.paid_at)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs rounded-full font-medium bg-orange-100 text-orange-800">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {fee.paid ? (
                        <button
                          onClick={() => markAsUnpaid(fee.id)}
                          className="text-orange-600 hover:text-orange-800 transition-colors flex items-center space-x-1 text-sm"
                        >
                          <X className="w-4 h-4" />
                          <span>Mark Unpaid</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => markAsPaid(fee.id)}
                          className="text-green-600 hover:text-green-800 transition-colors flex items-center space-x-1 text-sm"
                        >
                          <Check className="w-4 h-4" />
                          <span>Mark Paid</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-stone-600">
        Showing {filteredFees.length} of {fees.length} fees
      </div>
    </div>
  );
}
