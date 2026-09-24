import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Mail, Phone, User, TrendingUp } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';
import CustomerManagement from './CustomerManagement';
import { useCurrency } from '../../lib/currencyContext';
import { EMPTY_CUSTOMER_STATS, REGULAR_MIN_VISITS, fetchCustomerStatsForBusiness, formatCalendarDate, type CustomerStats } from '../../lib/customerStats';

interface CustomerRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
}

type Customer = CustomerRow & Omit<CustomerStats, 'customer_id'>;

export default function CustomersView() {
  const { formatPrice } = useCurrency();
  const { businessId } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, [businessId]);

  useEffect(() => {
    filterCustomers();
  }, [searchTerm, customers]);

  const fetchCustomers = async () => {
    if (!businessId) return;

    try {
      const [{ data, error }, statsById] = await Promise.all([
        supabase.from('customers').select('id, email, name, phone').eq('business_id', businessId),
        fetchCustomerStatsForBusiness(businessId),
      ]);
      if (error) throw error;

      const merged = ((data || []) as CustomerRow[])
        .map((row) => ({ ...row, ...EMPTY_CUSTOMER_STATS, ...statsById.get(row.id) }))
        .sort((a, b) => b.visits_count - a.visits_count || b.total_count - a.total_count);
      setCustomers(merged);
      setLoadError(null);
    } catch (err) {
      console.error('Error loading customers:', err);
      setLoadError('Could not load customers. Please refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!searchTerm) {
      setFilteredCustomers(customers);
      return;
    }

    const filtered = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    setFilteredCustomers(filtered);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">Customers</h1>
          <p className="text-gray-600">View customer profiles and booking history</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-center px-6 py-3 bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)]">
            <div className="text-2xl font-semibold text-gray-900">{customers.length}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Total Customers</div>
          </div>
          <div className="text-center px-6 py-3 bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)]">
            <div className="text-2xl font-semibold text-gray-900">
              {formatPrice(customers.reduce((sum, c) => sum + c.spent_cents, 0))}
            </div>
            <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">Spent on visits</div>
          </div>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1714] focus:border-transparent transition-all"
        />
      </div>

      <div className="bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F9F7F4]/80 border-b border-stone-200/70">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Visits
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  No-shows
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  First Visit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Last Visit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? 'No customers found' : 'No customers yet. Customers are automatically added when bookings are created.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#1A1714] to-[#2E2926] rounded-full flex items-center justify-center shadow-sm">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-sm font-semibold text-gray-900">{customer.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1.5">
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-3.5 h-3.5 mr-2 text-gray-400" />
                          {customer.email}
                        </div>
                        {customer.phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {customer.visits_count}
                        </span>
                        {customer.visits_count >= REGULAR_MIN_VISITS && (
                          <TrendingUp className="w-4 h-4 text-green-600" aria-label="Regular" />
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        {customer.total_count} booking{customer.total_count === 1 ? '' : 's'}
                        {customer.upcoming_count > 0 ? ` · ${customer.upcoming_count} upcoming` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.no_show_count > 0 ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{customer.no_show_count}</span>
                      ) : (
                        <span className="text-sm text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {formatPrice(customer.spent_cents)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatCalendarDate(customer.first_visit_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatCalendarDate(customer.last_visit_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-stone-600">
        Showing {filteredCustomers.length} of {customers.length} customers
      </div>

      {selectedCustomer && (
        <CustomerManagement
          customerId={selectedCustomer.id}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
