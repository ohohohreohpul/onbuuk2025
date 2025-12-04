import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Calendar, DollarSign, Mail, Phone, FileText, Plus, Trash2 } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

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

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  status: string;
  service: { name: string };
  duration: { duration_minutes: number; price_cents: number };
  specialist: { name: string } | null;
}

interface Note {
  id: string;
  note: string;
  created_by: string;
  created_at: string;
}

interface Props {
  customer: Customer;
  onClose: () => void;
  onUpdate: () => void;
}

export default function CustomerDetailModal({ customer, onClose, onUpdate }: Props) {
  const { user } = useAdminAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    fetchBookings();
    fetchNotes();
  }, [customer.id]);

  const fetchBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        start_time,
        status,
        service:services(name),
        duration:service_durations(duration_minutes, price_cents),
        specialist:specialists(name)
      `)
      .eq('customer_email', customer.email)
      .order('booking_date', { ascending: false });

    if (data) {
      setBookings(data as any);
    }
    setLoadingBookings(false);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('customer_notes')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (data) {
      setNotes(data);
    }
    setLoadingNotes(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !user) return;

    setAddingNote(true);

    try {
      const { error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customer.id,
          note: newNote.trim(),
          created_by: user.email || 'Admin',
        });

      if (error) throw error;

      setNewNote('');
      fetchNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-stone-100 text-stone-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-light text-stone-800">{customer.name}</h2>
            <p className="text-sm text-stone-600">Customer Profile</p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <div className="flex items-center space-x-2 text-stone-600 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs uppercase">Total Visits</span>
              </div>
              <div className="text-2xl font-light text-stone-800">{customer.total_bookings}</div>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <div className="flex items-center space-x-2 text-stone-600 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs uppercase">Total Spent</span>
              </div>
              <div className="text-2xl font-light text-stone-800">
                {formatCurrency(customer.total_spent_cents)}
              </div>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <div className="flex items-center space-x-2 text-stone-600 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs uppercase">First Visit</span>
              </div>
              <div className="text-lg font-light text-stone-800">
                {customer.first_visit_date ? formatDate(customer.first_visit_date) : 'N/A'}
              </div>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <div className="flex items-center space-x-2 text-stone-600 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs uppercase">Last Visit</span>
              </div>
              <div className="text-lg font-light text-stone-800">
                {customer.last_visit_date ? formatDate(customer.last_visit_date) : 'N/A'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2 text-stone-600">
              <Mail className="w-4 h-4" />
              <span>{customer.email}</span>
            </div>
            {customer.phone && (
              <div className="flex items-center space-x-2 text-stone-600">
                <Phone className="w-4 h-4" />
                <span>{customer.phone}</span>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Private Notes</span>
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a private note about this customer..."
                  rows={3}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="px-4 py-2 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center space-x-2 h-fit"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>

              {loadingNotes ? (
                <div className="text-center text-stone-500 py-4">Loading notes...</div>
              ) : notes.length === 0 ? (
                <div className="text-center text-stone-500 py-4 border border-stone-200 rounded bg-stone-50">
                  No notes yet. Add a note to keep track of important information.
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 bg-amber-50 border border-amber-200 rounded flex justify-between"
                    >
                      <div className="flex-1">
                        <p className="text-stone-800 whitespace-pre-wrap">{note.note}</p>
                        <p className="text-xs text-stone-500 mt-2">
                          {note.created_by} • {formatDateTime(note.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Visit History</span>
            </h3>
            {loadingBookings ? (
              <div className="text-center text-stone-500 py-8">Loading bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="text-center text-stone-500 py-8 border border-stone-200 rounded bg-stone-50">
                No bookings found
              </div>
            ) : (
              <div className="border border-stone-200 rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        Service
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        Specialist
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        Duration
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        Price
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3 text-sm text-stone-800">
                          {formatDate(booking.booking_date)}
                          <div className="text-xs text-stone-500">{booking.start_time}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-800">
                          {booking.service.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600">
                          {booking.specialist?.name || 'Any'}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600">
                          {booking.duration.duration_minutes} min
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-stone-800">
                          {formatCurrency(booking.duration.price_cents)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded ${getStatusColor(
                              booking.status
                            )}`}
                          >
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
