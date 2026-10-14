import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Calendar, DollarSign, Mail, Phone, FileText, Plus, Trash2 } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

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

const TEXT: Translations<{
  profile: string; close: string; totalVisits: string; totalSpent: string; firstVisit: string; lastVisit: string;
  notAvailable: string; privateNotes: string; notePlaceholder: string; add: string; loadingNotes: string;
  noNotes: string; deleteNote: string; confirmDeleteNote: string; addNoteFailed: string; deleteNoteFailed: string;
  visitHistory: string; loadingBookings: string; noBookings: string; date: string; service: string;
  specialist: string; duration: string; price: string; status: string; anySpecialist: string; minutes: string;
  statusConfirmed: string; statusPending: string; statusCompleted: string; statusCancelled: string;
}> = {
  en: {
    profile: 'Customer Profile', close: 'Close', totalVisits: 'Total Visits', totalSpent: 'Total Spent',
    firstVisit: 'First Visit', lastVisit: 'Last Visit', notAvailable: 'N/A', privateNotes: 'Private Notes',
    notePlaceholder: 'Add a private note about this customer...', add: 'Add', loadingNotes: 'Loading notes...',
    noNotes: 'No notes yet. Add a note to keep track of important information.', deleteNote: 'Delete note',
    confirmDeleteNote: 'Are you sure you want to delete this note?', addNoteFailed: 'Failed to add note',
    deleteNoteFailed: 'Failed to delete note', visitHistory: 'Visit History', loadingBookings: 'Loading bookings...',
    noBookings: 'No bookings found', date: 'Date', service: 'Service', specialist: 'Specialist',
    duration: 'Duration', price: 'Price', status: 'Status', anySpecialist: 'Any', minutes: '{count} min',
    statusConfirmed: 'Confirmed', statusPending: 'Pending', statusCompleted: 'Completed', statusCancelled: 'Cancelled',
  },
  de: {
    profile: 'Kundenprofil', close: 'Schließen', totalVisits: 'Besuche gesamt', totalSpent: 'Umsatz gesamt',
    firstVisit: 'Erster Besuch', lastVisit: 'Letzter Besuch', notAvailable: 'k. A.', privateNotes: 'Interne Notizen',
    notePlaceholder: 'Interne Notiz zu diesem Kunden hinzufügen...', add: 'Hinzufügen', loadingNotes: 'Notizen werden geladen...',
    noNotes: 'Noch keine Notizen. Notizen helfen, wichtige Informationen festzuhalten.', deleteNote: 'Notiz löschen',
    confirmDeleteNote: 'Diese Notiz wirklich löschen?', addNoteFailed: 'Notiz konnte nicht hinzugefügt werden',
    deleteNoteFailed: 'Notiz konnte nicht gelöscht werden', visitHistory: 'Besuchsverlauf',
    loadingBookings: 'Buchungen werden geladen...', noBookings: 'Keine Buchungen gefunden', date: 'Datum',
    service: 'Leistung', specialist: 'Therapeut:in', duration: 'Dauer', price: 'Preis', status: 'Status',
    anySpecialist: 'Beliebig', minutes: '{count} Min.',
    statusConfirmed: 'Bestätigt', statusPending: 'Ausstehend', statusCompleted: 'Abgeschlossen', statusCancelled: 'Storniert',
  },
  th: {
    profile: 'โปรไฟล์ลูกค้า', close: 'ปิด', totalVisits: 'จำนวนการเข้าใช้บริการ', totalSpent: 'ยอดใช้จ่ายรวม',
    firstVisit: 'เข้าใช้บริการครั้งแรก', lastVisit: 'เข้าใช้บริการล่าสุด', notAvailable: 'ไม่มีข้อมูล', privateNotes: 'บันทึกส่วนตัว',
    notePlaceholder: 'เพิ่มบันทึกส่วนตัวเกี่ยวกับลูกค้ารายนี้...', add: 'เพิ่ม', loadingNotes: 'กำลังโหลดบันทึก...',
    noNotes: 'ยังไม่มีบันทึก เพิ่มบันทึกเพื่อเก็บข้อมูลสำคัญ', deleteNote: 'ลบบันทึก',
    confirmDeleteNote: 'ต้องการลบบันทึกนี้ใช่หรือไม่?', addNoteFailed: 'เพิ่มบันทึกไม่สำเร็จ',
    deleteNoteFailed: 'ลบบันทึกไม่สำเร็จ', visitHistory: 'ประวัติการเข้าใช้บริการ', loadingBookings: 'กำลังโหลดการจอง...',
    noBookings: 'ไม่พบการจอง', date: 'วันที่', service: 'บริการ', specialist: 'ผู้ให้บริการ',
    duration: 'ระยะเวลา', price: 'ราคา', status: 'สถานะ', anySpecialist: 'ใครก็ได้', minutes: '{count} นาที',
    statusConfirmed: 'ยืนยันแล้ว', statusPending: 'รอดำเนินการ', statusCompleted: 'เสร็จสิ้น', statusCancelled: 'ยกเลิกแล้ว',
  },
};

interface Props {
  customer: Customer;
  onClose: () => void;
  onUpdate: () => void;
}

export default function CustomerDetailModal({ customer, onClose }: Props) {
  const { formatPrice } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const user = useAdminAuth();
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
      alert(t.addNoteFailed);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm(t.confirmDeleteNote)) return;

    try {
      const { error } = await supabase
        .from('customer_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert(t.deleteNoteFailed);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const statusLabels: Record<string, string> = {
    confirmed: t.statusConfirmed,
    pending: t.statusPending,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
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
            <p className="text-sm text-stone-600">{t.profile}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
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
                <span className="text-xs uppercase">{t.totalVisits}</span>
              </div>
              <div className="text-2xl font-light text-stone-800">{customer.total_bookings}</div>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <div className="flex items-center space-x-2 text-stone-600 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs uppercase">{t.totalSpent}</span>
              </div>
              <div className="text-2xl font-light text-stone-800">
                {formatPrice(customer.total_spent_cents)}
              </div>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <div className="flex items-center space-x-2 text-stone-600 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs uppercase">{t.firstVisit}</span>
              </div>
              <div className="text-lg font-light text-stone-800">
                {customer.first_visit_date ? formatDate(customer.first_visit_date) : t.notAvailable}
              </div>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <div className="flex items-center space-x-2 text-stone-600 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-xs uppercase">{t.lastVisit}</span>
              </div>
              <div className="text-lg font-light text-stone-800">
                {customer.last_visit_date ? formatDate(customer.last_visit_date) : t.notAvailable}
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
              <span>{t.privateNotes}</span>
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t.notePlaceholder}
                  rows={3}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="px-4 py-2 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center space-x-2 h-fit"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.add}</span>
                </button>
              </div>

              {loadingNotes ? (
                <div className="text-center text-stone-500 py-4">{t.loadingNotes}</div>
              ) : notes.length === 0 ? (
                <div className="text-center text-stone-500 py-4 border border-stone-200 rounded bg-stone-50">
                  {t.noNotes}
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
                        aria-label={t.deleteNote}
                        title={t.deleteNote}
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
              <span>{t.visitHistory}</span>
            </h3>
            {loadingBookings ? (
              <div className="text-center text-stone-500 py-8">{t.loadingBookings}</div>
            ) : bookings.length === 0 ? (
              <div className="text-center text-stone-500 py-8 border border-stone-200 rounded bg-stone-50">
                {t.noBookings}
              </div>
            ) : (
              <div className="border border-stone-200 rounded overflow-hidden">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        {t.date}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        {t.service}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        {t.specialist}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        {t.duration}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        {t.price}
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-stone-600 uppercase">
                        {t.status}
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
                          {booking.specialist?.name || t.anySpecialist}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600">
                          {fillText(t.minutes, { count: booking.duration.duration_minutes })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-stone-800">
                          {formatPrice(booking.duration.price_cents)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded ${getStatusColor(
                              booking.status
                            )}`}
                          >
                            {statusLabels[booking.status] ?? booking.status}
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
