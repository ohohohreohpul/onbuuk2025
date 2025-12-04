import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Calendar, DollarSign, FileText, Search, X } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  total_bookings: number;
  total_spent_cents: number;
  first_visit_date: string | null;
  last_visit_date: string | null;
  created_at: string;
}

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  no_show: boolean;
  service: { name: string };
  duration: { duration_minutes: number; price_cents: number };
}

interface NoShowFee {
  id: string;
  amount: number;
  reason: string;
  charged_at: string;
  paid: boolean;
  notes: string | null;
}

interface CustomerNote {
  id: string;
  note: string;
  created_by: string;
  created_at: string;
}

type SidebarTab = 'info' | 'bookings' | 'fees' | 'notes';

interface CustomerManagementProps {
  customerId: string;
  onClose: () => void;
}

export default function CustomerManagement({ customerId, onClose }: CustomerManagementProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('info');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fees, setFees] = useState<NoShowFee[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  const fetchCustomerData = async () => {
    setLoading(true);

    const { data: customerData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerData) {
      setCustomer(customerData);
    }

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name),
        duration:service_durations(duration_minutes, price_cents)
      `)
      .eq('customer_email', customerData?.email)
      .order('booking_date', { ascending: false });

    if (bookingsData) {
      setBookings(bookingsData as any);
    }

    const { data: feesData } = await supabase
      .from('no_show_fees')
      .select('*')
      .eq('customer_id', customerId)
      .order('charged_at', { ascending: false });

    if (feesData) {
      setFees(feesData);
    }

    const { data: notesData } = await supabase
      .from('customer_notes')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (notesData) {
      setNotes(notesData);
    }

    setLoading(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    const { error } = await supabase.from('customer_notes').insert({
      customer_id: customerId,
      note: newNote,
      created_by: 'Admin',
    });

    if (!error) {
      setNewNote('');
      fetchCustomerData();
    }
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-6xl h-[90vh] flex flex-col">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-light text-stone-800">{customer.name}</h2>
            <p className="text-sm text-stone-600">{customer.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-stone-200 p-4 space-y-2">
            <button
              onClick={() => setActiveTab('info')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'info'
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <User className="w-5 h-5" />
              <span>Customer Info</span>
            </button>

            <button
              onClick={() => setActiveTab('bookings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'bookings'
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <div className="flex items-center justify-between flex-1">
                <span>Bookings</span>
                <span className="text-xs px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                  {bookings.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('fees')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'fees'
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              <div className="flex items-center justify-between flex-1">
                <span>Fees</span>
                {fees.length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">
                    {fees.filter((f) => !f.paid).length}
                  </span>
                )}
              </div>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'notes'
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <FileText className="w-5 h-5" />
              <div className="flex items-center justify-between flex-1">
                <span>Notes</span>
                <span className="text-xs px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                  {notes.length}
                </span>
              </div>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'info' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-stone-800 mb-4">Contact Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-stone-600">Email</label>
                      <p className="text-stone-800">{customer.email}</p>
                    </div>
                    <div>
                      <label className="text-sm text-stone-600">Phone</label>
                      <p className="text-stone-800">{customer.phone || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-6">
                  <h3 className="text-lg font-medium text-stone-800 mb-4">Statistics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-stone-50 border border-stone-200">
                      <p className="text-sm text-stone-600 mb-1">Total Bookings</p>
                      <p className="text-2xl font-light text-stone-800">{customer.total_bookings}</p>
                    </div>
                    <div className="p-4 bg-stone-50 border border-stone-200">
                      <p className="text-sm text-stone-600 mb-1">Total Spent</p>
                      <p className="text-2xl font-light text-stone-800">
                        {formatPrice(customer.total_spent_cents)}
                      </p>
                    </div>
                    <div className="p-4 bg-stone-50 border border-stone-200">
                      <p className="text-sm text-stone-600 mb-1">First Visit</p>
                      <p className="text-sm text-stone-800">
                        {customer.first_visit_date ? formatDate(customer.first_visit_date) : 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-stone-50 border border-stone-200">
                      <p className="text-sm text-stone-600 mb-1">Last Visit</p>
                      <p className="text-sm text-stone-800">
                        {customer.last_visit_date ? formatDate(customer.last_visit_date) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-stone-800">Booking History</h3>
                {bookings.length === 0 ? (
                  <p className="text-stone-500 text-center py-8">No bookings found</p>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="p-4 border border-stone-200 hover:border-stone-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-stone-800">{booking.service.name}</h4>
                            <p className="text-sm text-stone-600">
                              {booking.duration.duration_minutes} minutes
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-stone-800">
                              {formatPrice(booking.duration.price_cents)}
                            </p>
                            <span
                              className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                                booking.status === 'confirmed'
                                  ? 'bg-green-100 text-green-800'
                                  : booking.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : booking.status === 'completed'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {booking.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <span>
                            {formatDate(booking.booking_date)} at {booking.start_time}
                          </span>
                          {booking.no_show && (
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">
                              No-show
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'fees' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-stone-800">No-Show Fees</h3>
                {fees.length === 0 ? (
                  <p className="text-stone-500 text-center py-8">No fees found</p>
                ) : (
                  <div className="space-y-3">
                    {fees.map((fee) => (
                      <div
                        key={fee.id}
                        className="p-4 border border-stone-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
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
                              <p className="text-sm text-stone-600 mt-2">{fee.notes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-stone-800">{formatPrice(fee.amount)}</p>
                            <span
                              className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                                fee.paid
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {fee.paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-stone-600">{formatDate(fee.charged_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-stone-800">Customer Notes</h3>
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note about this customer..."
                      rows={3}
                      className="flex-1 px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 resize-none"
                    />
                    <button
                      onClick={addNote}
                      className="px-6 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-stone-500 text-center py-8">No notes yet</p>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="p-4 bg-stone-50 border border-stone-200">
                          <p className="text-stone-800 mb-2">{note.note}</p>
                          <div className="flex items-center justify-between text-xs text-stone-500">
                            <span>By {note.created_by}</span>
                            <span>{formatDate(note.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
