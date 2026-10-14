import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Calendar, DollarSign, FileText, X } from 'lucide-react';
import { useCurrency } from '../../lib/currencyContext';
import { EMPTY_CUSTOMER_STATS, fetchCustomerStats, type CustomerStats } from '../../lib/customerStats';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  business_id: string;
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
  resolution_status: 'unpaid' | 'paid' | 'waived';
  notes: string | null;
}

interface CustomerNote {
  id: string;
  note: string;
  created_by: string;
  created_at: string;
}

type SidebarTab = 'info' | 'bookings' | 'fees' | 'notes';

const TEXT: Translations<{
  close: string; tabInfo: string; tabBookings: string; tabFees: string; tabNotes: string; unpaidCount: string;
  contactInfo: string; email: string; phone: string; notProvided: string; statistics: string;
  visits: string; noShows: string; cancelled: string; upcoming: string; totalOne: string; totalMany: string;
  spentOnVisits: string; firstVisit: string; lastVisit: string; bookingHistory: string; noBookings: string;
  minutes: string; dateAtTime: string; noShowBadge: string; statusConfirmed: string; statusPending: string;
  statusCompleted: string; statusCancelled: string; feesTitle: string; noFees: string; reasonNoShow: string;
  reasonLateCancel: string; paid: string; waived: string; unpaid: string; notesTitle: string;
  notePlaceholder: string; add: string; noNotes: string; byAuthor: string;
}> = {
  en: {
    close: 'Close', tabInfo: 'Customer Info', tabBookings: 'Bookings', tabFees: 'Fees', tabNotes: 'Notes',
    unpaidCount: '{count} unpaid', contactInfo: 'Contact Information', email: 'Email', phone: 'Phone',
    notProvided: 'Not provided', statistics: 'Statistics', visits: 'Visits', noShows: 'No-shows',
    cancelled: 'Cancelled', upcoming: 'Upcoming',
    totalOne: '{count} booking in total, matching the Bookings tab.',
    totalMany: '{count} bookings in total, matching the Bookings tab.',
    spentOnVisits: 'Spent on visits', firstVisit: 'First visit', lastVisit: 'Last visit',
    bookingHistory: 'Booking History', noBookings: 'No bookings found', minutes: '{count} minutes',
    dateAtTime: '{date} at {time}', noShowBadge: 'No-show', statusConfirmed: 'Confirmed',
    statusPending: 'Pending', statusCompleted: 'Completed', statusCancelled: 'Cancelled',
    feesTitle: 'No-Show Fees', noFees: 'No fees found', reasonNoShow: 'No-Show', reasonLateCancel: 'Late Cancel',
    paid: 'Paid', waived: 'Waived', unpaid: 'Unpaid', notesTitle: 'Customer Notes',
    notePlaceholder: 'Add a note about this customer...', add: 'Add', noNotes: 'No notes yet', byAuthor: 'By {name}',
  },
  de: {
    close: 'Schließen', tabInfo: 'Kundendaten', tabBookings: 'Buchungen', tabFees: 'Gebühren', tabNotes: 'Notizen',
    unpaidCount: '{count} offen', contactInfo: 'Kontaktdaten', email: 'E-Mail', phone: 'Telefon',
    notProvided: 'Nicht angegeben', statistics: 'Statistik', visits: 'Besuche', noShows: 'No-Shows',
    cancelled: 'Storniert', upcoming: 'Anstehend',
    totalOne: '{count} Buchung insgesamt, wie im Tab „Buchungen“.',
    totalMany: '{count} Buchungen insgesamt, wie im Tab „Buchungen“.',
    spentOnVisits: 'Umsatz aus Besuchen', firstVisit: 'Erster Besuch', lastVisit: 'Letzter Besuch',
    bookingHistory: 'Buchungsverlauf', noBookings: 'Keine Buchungen gefunden', minutes: '{count} Minuten',
    dateAtTime: '{date} um {time}', noShowBadge: 'No-Show', statusConfirmed: 'Bestätigt',
    statusPending: 'Ausstehend', statusCompleted: 'Abgeschlossen', statusCancelled: 'Storniert',
    feesTitle: 'No-Show-Gebühren', noFees: 'Keine Gebühren gefunden', reasonNoShow: 'No-Show',
    reasonLateCancel: 'Späte Stornierung', paid: 'Bezahlt', waived: 'Erlassen', unpaid: 'Offen',
    notesTitle: 'Kundennotizen', notePlaceholder: 'Notiz zu diesem Kunden hinzufügen...', add: 'Hinzufügen',
    noNotes: 'Noch keine Notizen', byAuthor: 'Von {name}',
  },
  th: {
    close: 'ปิด', tabInfo: 'ข้อมูลลูกค้า', tabBookings: 'การจอง', tabFees: 'ค่าธรรมเนียม', tabNotes: 'บันทึก',
    unpaidCount: 'ค้างชำระ {count}', contactInfo: 'ข้อมูลติดต่อ', email: 'อีเมล', phone: 'เบอร์โทร',
    notProvided: 'ไม่ได้ระบุ', statistics: 'สถิติ', visits: 'การเข้าใช้บริการ', noShows: 'ไม่มาตามนัด',
    cancelled: 'ยกเลิกแล้ว', upcoming: 'กำลังจะมาถึง',
    totalOne: 'รวม {count} การจอง ตรงกับแท็บการจอง',
    totalMany: 'รวม {count} การจอง ตรงกับแท็บการจอง',
    spentOnVisits: 'ยอดใช้จ่ายจากการเข้าใช้บริการ', firstVisit: 'เข้าใช้บริการครั้งแรก', lastVisit: 'เข้าใช้บริการล่าสุด',
    bookingHistory: 'ประวัติการจอง', noBookings: 'ไม่พบการจอง', minutes: '{count} นาที',
    dateAtTime: '{date} เวลา {time}', noShowBadge: 'ไม่มาตามนัด', statusConfirmed: 'ยืนยันแล้ว',
    statusPending: 'รอดำเนินการ', statusCompleted: 'เสร็จสิ้น', statusCancelled: 'ยกเลิกแล้ว',
    feesTitle: 'ค่าธรรมเนียมไม่มาตามนัด', noFees: 'ไม่พบค่าธรรมเนียม', reasonNoShow: 'ไม่มาตามนัด',
    reasonLateCancel: 'ยกเลิกล่าช้า', paid: 'ชำระแล้ว', waived: 'ยกเว้นแล้ว', unpaid: 'ค้างชำระ',
    notesTitle: 'บันทึกลูกค้า', notePlaceholder: 'เพิ่มบันทึกเกี่ยวกับลูกค้ารายนี้...', add: 'เพิ่ม',
    noNotes: 'ยังไม่มีบันทึก', byAuthor: 'โดย {name}',
  },
};

type CustomerText = (typeof TEXT)['en'];

/** Displayed label for a booking status; unknown statuses are shown as stored. */
function statusLabel(status: string, t: CustomerText): string {
  const labels: Record<string, string> = {
    confirmed: t.statusConfirmed,
    pending: t.statusPending,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };
  return labels[status] ?? status;
}

/** A YYYY-MM-DD calendar date in the admin's language, without time-zone shifts. */
function formatDay(value: string | null, locale: string): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface CustomerManagementProps {
  customerId: string;
  onClose: () => void;
}

export default function CustomerManagement({ customerId, onClose }: CustomerManagementProps) {
  const { formatPrice } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const [activeTab, setActiveTab] = useState<SidebarTab>('info');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [stats, setStats] = useState<CustomerStats>({ customer_id: customerId, ...EMPTY_CUSTOMER_STATS });
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

    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customerData) {
      console.error('Error loading customer:', customerError);
      setLoading(false);
      return;
    }
    setCustomer(customerData);

    try {
      setStats(await fetchCustomerStats(customerId));
    } catch (err) {
      console.error(err);
    }

    // Same matching rule as the customer_stats view: this business, case-insensitive email.
    const escapedEmail = customerData.email.trim().replace(/[\\%_]/g, (ch: string) => `\\${ch}`);
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(name),
        duration:service_durations(duration_minutes, price_cents)
      `)
      .eq('business_id', customerData.business_id)
      .ilike('customer_email', escapedEmail)
      .order('booking_date', { ascending: false });

    if (bookingsError) {
      console.error('Error loading customer bookings:', bookingsError);
    }
    const customerBookings = (bookingsData || []) as unknown as Booking[];
    setBookings(customerBookings);

    const bookingIds = customerBookings.map((booking) => booking.id);
    const { data: feesData, error: feesError } = bookingIds.length
      ? await supabase
          .from('no_show_fees')
          .select('*')
          .in('booking_id', bookingIds)
          .order('charged_at', { ascending: false })
      : { data: [], error: null };

    if (feesError) {
      console.error('Error loading customer fees:', feesError);
    }
    setFees((feesData || []) as NoShowFee[]);

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



  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
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
            aria-label={t.close}
            title={t.close}
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
              <span>{t.tabInfo}</span>
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
                <span>{t.tabBookings}</span>
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
                <span>{t.tabFees}</span>
                {fees.some((f) => f.resolution_status === 'unpaid') && (
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full">
                    {fillText(t.unpaidCount, { count: fees.filter((f) => f.resolution_status === 'unpaid').length })}
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
                <span>{t.tabNotes}</span>
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
                  <h3 className="text-lg font-medium text-stone-800 mb-4">{t.contactInfo}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-stone-600">{t.email}</label>
                      <p className="text-stone-800">{customer.email}</p>
                    </div>
                    <div>
                      <label className="text-sm text-stone-600">{t.phone}</label>
                      <p className="text-stone-800">{customer.phone || t.notProvided}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-6">
                  <h3 className="text-lg font-medium text-stone-800 mb-4">{t.statistics}</h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { key: 'visits', label: t.visits, value: stats.visits_count },
                      { key: 'noShows', label: t.noShows, value: stats.no_show_count },
                      { key: 'cancelled', label: t.cancelled, value: stats.cancelled_count },
                      { key: 'upcoming', label: t.upcoming, value: stats.upcoming_count },
                    ].map((item) => (
                      <div key={item.key} className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                        <p className="text-sm text-stone-600 mb-1">{item.label}</p>
                        <p className="text-2xl font-light text-stone-800 tabular-nums">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-stone-400">
                    {fillText(stats.total_count === 1 ? t.totalOne : t.totalMany, { count: stats.total_count })}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                      <p className="text-sm text-stone-600 mb-1">{t.spentOnVisits}</p>
                      <p className="text-2xl font-light text-stone-800">{formatPrice(stats.spent_cents)}</p>
                    </div>
                    <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                      <p className="text-sm text-stone-600 mb-1">{t.firstVisit}</p>
                      <p className="text-sm text-stone-800">{formatDay(stats.first_visit_date, locale)}</p>
                    </div>
                    <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
                      <p className="text-sm text-stone-600 mb-1">{t.lastVisit}</p>
                      <p className="text-sm text-stone-800">{formatDay(stats.last_visit_date, locale)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'bookings' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-stone-800">{t.bookingHistory}</h3>
                {bookings.length === 0 ? (
                  <p className="text-stone-500 text-center py-8">{t.noBookings}</p>
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
                              {fillText(t.minutes, { count: booking.duration.duration_minutes })}
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
                              {statusLabel(booking.status, t)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-stone-600">
                          <span>
                            {fillText(t.dateAtTime, { date: formatDay(booking.booking_date, locale), time: booking.start_time.slice(0, 5) })}
                          </span>
                          {booking.no_show && (
                            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">
                              {t.noShowBadge}
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
                <h3 className="text-lg font-medium text-stone-800">{t.feesTitle}</h3>
                {fees.length === 0 ? (
                  <p className="text-stone-500 text-center py-8">{t.noFees}</p>
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
                              {fee.reason === 'no_show' ? t.reasonNoShow : t.reasonLateCancel}
                            </span>
                            {fee.notes && (
                              <p className="text-sm text-stone-600 mt-2">{fee.notes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-stone-800">{formatPrice(fee.amount)}</p>
                            <span
                              className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                                fee.resolution_status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : fee.resolution_status === 'waived'
                                    ? 'bg-stone-100 text-stone-600'
                                    : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {fee.resolution_status === 'paid' ? t.paid : fee.resolution_status === 'waived' ? t.waived : t.unpaid}
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
                <h3 className="text-lg font-medium text-stone-800">{t.notesTitle}</h3>
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder={t.notePlaceholder}
                      rows={3}
                      className="flex-1 px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 resize-none"
                    />
                    <button
                      onClick={addNote}
                      className="px-6 bg-stone-800 text-white hover:bg-stone-700 transition-colors"
                    >
                      {t.add}
                    </button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-stone-500 text-center py-8">{t.noNotes}</p>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div key={note.id} className="p-4 bg-stone-50 border border-stone-200">
                          <p className="text-stone-800 mb-2">{note.note}</p>
                          <div className="flex items-center justify-between text-xs text-stone-500">
                            <span>{fillText(t.byAuthor, { name: note.created_by })}</span>
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
