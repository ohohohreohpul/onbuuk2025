import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Mail, Phone, User, TrendingUp } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';
import CustomerManagement from './CustomerManagement';

interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  total_bookings: number;
  total_spent_cents: number;
  first_visit_date: string | null;
  last_visit_date: string | null;
}

export default function CustomersView() {
  const { businessId } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
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

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', businessId)
      .order('total_bookings', { ascending: false });

    if (data) {
      setCustomers(data);
    }

    setLoading(false);
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

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
          <h1 className="text-3xl font-light text-stone-800 mb-2">Customers</h1>
          <p className="text-stone-600">View customer profiles and booking history</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-center px-6 py-3 bg-stone-50 border border-stone-200 rounded">
            <div className="text-2xl font-light text-stone-800">{customers.length}</div>
            <div className="text-xs text-stone-600 uppercase">Total Customers</div>
          </div>
          <div className="text-center px-6 py-3 bg-stone-50 border border-stone-200 rounded">
            <div className="text-2xl font-light text-stone-800">
              {formatCurrency(customers.reduce((sum, c) => sum + c.total_spent_cents, 0))}
            </div>
            <div className="text-xs text-stone-600 uppercase">Total Revenue</div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-stone-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
        />
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
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Total Visits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Total Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  First Visit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-600 uppercase tracking-wider">
                  Last Visit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-stone-500">
                    {searchTerm ? 'No customers found' : 'No customers yet. Customers are automatically added when bookings are created.'}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-stone-600" />
                        </div>
                        <div className="text-sm font-medium text-stone-800">{customer.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center text-sm text-stone-600">
                          <Mail className="w-3 h-3 mr-2" />
                          {customer.email}
                        </div>
                        {customer.phone && (
                          <div className="flex items-center text-sm text-stone-600">
                            <Phone className="w-3 h-3 mr-2" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-stone-800">
                          {customer.total_bookings}
                        </span>
                        {customer.total_bookings > 5 && (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-stone-800">
                      {formatCurrency(customer.total_spent_cents)}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {formatDate(customer.first_visit_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {formatDate(customer.last_visit_date)}
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
