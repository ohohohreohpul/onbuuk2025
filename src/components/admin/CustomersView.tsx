import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Ban, ChevronRight, Search, Mail, Phone, TrendingUp } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';
import CustomerManagement from './CustomerManagement';
import { useCurrency } from '../../lib/currencyContext';
import { EMPTY_CUSTOMER_STATS, REGULAR_MIN_VISITS, fetchCustomerStatsForBusiness, type CustomerStats } from '../../lib/customerStats';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';
import { ADMIN_SEGMENTED_CONTROL, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE } from './adminUi';
import CustomerAvatar from './customers/CustomerAvatar';
import TidyUpPanel from './customers/tidyUp/TidyUpPanel';
import { findDuplicateGroups } from './customers/tidyUp/duplicateGroups';
import { loadCustomerAliases, loadDismissedPairs } from './customers/tidyUp/tidyUpApi';
import { TIDY_UP_TEXT } from './customers/tidyUp/tidyUpText';

interface CustomerRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  blocked_at: string | null;
}

type Customer = CustomerRow & Omit<CustomerStats, 'customer_id'> & { extraEmails: string[]; extraPhones: string[] };

const TEXT: Translations<{
  title: string; subtitle: string; totalCustomers: string; spentOnVisits: string; loadError: string;
  searchPlaceholder: string; customer: string; contact: string; visits: string; noShows: string;
  totalSpent: string; firstVisit: string; lastVisit: string; noResults: string; empty: string;
  regular: string; blocked: string; bookingOne: string; bookingMany: string; upcoming: string; showing: string;
}> = {
  en: {
    title: 'Customers', subtitle: 'View customer profiles and booking history',
    totalCustomers: 'Total Customers', spentOnVisits: 'Spent on visits',
    loadError: 'Could not load customers. Please refresh to try again.',
    searchPlaceholder: 'Search by name, email, or phone...',
    customer: 'Customer', contact: 'Contact', visits: 'Visits', noShows: 'No-shows',
    totalSpent: 'Total Spent', firstVisit: 'First Visit', lastVisit: 'Last Visit',
    noResults: 'No customers found',
    empty: 'No customers yet. Customers are automatically added when bookings are created.',
    regular: 'Regular', blocked: 'Blocked', bookingOne: '{count} booking', bookingMany: '{count} bookings',
    upcoming: '{count} upcoming', showing: 'Showing {shown} of {total} customers',
  },
  de: {
    title: 'Kunden', subtitle: 'Kundenprofile und Buchungsverlauf ansehen',
    totalCustomers: 'Kunden gesamt', spentOnVisits: 'Umsatz aus Besuchen',
    loadError: 'Kunden konnten nicht geladen werden. Bitte Seite neu laden.',
    searchPlaceholder: 'Nach Name, E-Mail oder Telefon suchen...',
    customer: 'Kunde', contact: 'Kontakt', visits: 'Besuche', noShows: 'No-Shows',
    totalSpent: 'Umsatz gesamt', firstVisit: 'Erster Besuch', lastVisit: 'Letzter Besuch',
    noResults: 'Keine Kunden gefunden',
    empty: 'Noch keine Kunden. Kunden werden automatisch angelegt, sobald Buchungen eingehen.',
    regular: 'Stammkunde', blocked: 'Gesperrt', bookingOne: '{count} Buchung', bookingMany: '{count} Buchungen',
    upcoming: '{count} anstehend', showing: '{shown} von {total} Kunden',
  },
  th: {
    title: 'ลูกค้า', subtitle: 'ดูโปรไฟล์ลูกค้าและประวัติการจอง',
    totalCustomers: 'ลูกค้าทั้งหมด', spentOnVisits: 'ยอดใช้จ่ายจากการเข้าใช้บริการ',
    loadError: 'โหลดข้อมูลลูกค้าไม่สำเร็จ กรุณารีเฟรชแล้วลองอีกครั้ง',
    searchPlaceholder: 'ค้นหาด้วยชื่อ อีเมล หรือเบอร์โทร...',
    customer: 'ลูกค้า', contact: 'ติดต่อ', visits: 'การเข้าใช้บริการ', noShows: 'ไม่มาตามนัด',
    totalSpent: 'ยอดใช้จ่ายรวม', firstVisit: 'เข้าใช้บริการครั้งแรก', lastVisit: 'เข้าใช้บริการล่าสุด',
    noResults: 'ไม่พบลูกค้า',
    empty: 'ยังไม่มีลูกค้า ระบบจะเพิ่มลูกค้าให้อัตโนมัติเมื่อมีการจอง',
    regular: 'ลูกค้าประจำ', blocked: 'ถูกระงับ', bookingOne: '{count} การจอง', bookingMany: '{count} การจอง',
    upcoming: 'กำลังจะมาถึง {count}', showing: 'แสดง {shown} จาก {total} ราย',
  },
};

/** A YYYY-MM-DD calendar date in the admin's language, without time-zone shifts. */
function formatDay(value: string | null, locale: string): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CustomersView() {
  const { formatPrice } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const { businessId } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'all' | 'tidy'>('all');
  const { t: tidyText } = useAdminText(TIDY_UP_TEXT);
  const duplicateGroups = useMemo(() => findDuplicateGroups(customers, dismissedPairs), [customers, dismissedPairs]);

  useEffect(() => {
    fetchCustomers();
  }, [businessId]);

  useEffect(() => {
    filterCustomers();
  }, [searchTerm, customers]);

  const fetchCustomers = async () => {
    if (!businessId) return;

    try {
      const [{ data, error }, statsById, dismissed, aliasesById] = await Promise.all([
        supabase.from('customers').select('id, email, name, phone, blocked_at').eq('business_id', businessId),
        fetchCustomerStatsForBusiness(businessId),
        loadDismissedPairs(businessId),
        loadCustomerAliases(businessId),
      ]);
      if (error) throw error;
      setDismissedPairs(dismissed);

      const merged = ((data || []) as CustomerRow[])
        .map((row) => {
          const aliases = aliasesById.get(row.id) ?? [];
          return {
            ...row, ...EMPTY_CUSTOMER_STATS, ...statsById.get(row.id),
            extraEmails: aliases.filter((alias) => alias.kind === 'email').map((alias) => alias.value),
            extraPhones: aliases.filter((alias) => alias.kind === 'phone').map((alias) => alias.value),
          };
        })
        .sort((a, b) => b.visits_count - a.visits_count || b.total_count - a.total_count);
      setCustomers(merged);
      setHasLoadError(false);
    } catch (err) {
      console.error('Error loading customers:', err);
      setHasLoadError(true);
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
        (c.phone && c.phone.includes(searchTerm)) ||
        // "Also known as": earlier emails and numbers find the customer too.
        c.extraEmails.some((email) => email.includes(searchTerm.toLowerCase())) ||
        c.extraPhones.some((phone) => phone.includes(searchTerm))
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="text-center px-4 sm:px-6 py-3 bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)]">
            <div className="text-2xl font-semibold text-gray-900">{customers.length}</div>
            <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">{t.totalCustomers}</div>
          </div>
          <div className="text-center px-4 sm:px-6 py-3 bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)]">
            <div className="text-2xl font-semibold text-gray-900">
              {formatPrice(customers.reduce((sum, c) => sum + c.spent_cents, 0))}
            </div>
            <div className="text-xs text-gray-600 uppercase tracking-wider font-medium">{t.spentOnVisits}</div>
          </div>
        </div>
      </div>

      {hasLoadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t.loadError}</div>
      )}

      <div className={ADMIN_SEGMENTED_CONTROL} role="tablist">
        {([['all', tidyText.allCustomers], ['tidy', fillText(tidyText.tidyUp, { count: duplicateGroups.length })]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === id ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'tidy' && <TidyUpPanel groups={duplicateGroups} onChanged={fetchCustomers} />}

      {tab === 'all' && (<>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1714] focus:border-transparent transition-all"
        />
      </div>

      {/* Phones: one card per customer. Wide screens: the full table below. */}
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/70 bg-white/70 shadow-[0_2px_16px_rgba(26,23,20,0.05)] md:hidden">
        {filteredCustomers.length === 0 ? (
          <li className="px-5 py-10 text-center text-sm text-gray-500">{searchTerm ? t.noResults : t.empty}</li>
        ) : filteredCustomers.map((customer) => (
          <li key={customer.id}>
            <button type="button" onClick={() => setSelectedCustomer(customer)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-stone-50">
              <CustomerAvatar name={customer.name} isBlocked={Boolean(customer.blocked_at)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-[#1A1714]">{customer.name}</span>
                  {customer.visits_count >= REGULAR_MIN_VISITS && <TrendingUp className="h-3.5 w-3.5 shrink-0 text-green-600" aria-label={t.regular} />}
                </span>
                <span className="block truncate text-[13px] text-stone-500">{customer.phone || customer.email}</span>
                {customer.blocked_at && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                    <Ban className="h-3 w-3" aria-hidden="true" />{t.blocked}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums text-[#1A1714]">{formatPrice(customer.spent_cents)}</span>
                <span className="block text-[12px] text-stone-500">
                  {customer.visits_count} {t.visits}
                  {customer.no_show_count > 0 && <span className="ml-1.5 font-medium text-red-700">· {customer.no_show_count} {t.noShows}</span>}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)] overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F9F7F4]/80 border-b border-stone-200/70">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t.customer}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t.contact}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t.visits}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t.noShows}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t.totalSpent}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t.firstVisit}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  {t.lastVisit}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    {searchTerm ? t.noResults : t.empty}
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
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={customer.name} isBlocked={Boolean(customer.blocked_at)} />
                        <div className="min-w-0">
                          <div className="whitespace-nowrap text-sm font-semibold text-gray-900">{customer.name}</div>
                          {customer.blocked_at && (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                              <Ban className="h-3 w-3" aria-hidden="true" />{t.blocked}
                            </span>
                          )}
                        </div>
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
                          <TrendingUp className="w-4 h-4 text-green-600" aria-label={t.regular} />
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        {fillText(customer.total_count === 1 ? t.bookingOne : t.bookingMany, { count: customer.total_count })}
                        {customer.upcoming_count > 0 ? ` · ${fillText(t.upcoming, { count: customer.upcoming_count })}` : ''}
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
                      {formatDay(customer.first_visit_date, locale)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDay(customer.last_visit_date, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-sm text-stone-600">
        {fillText(t.showing, { shown: filteredCustomers.length, total: customers.length })}
      </div>
      </>)}

      {selectedCustomer && (
        <CustomerManagement
          customerId={selectedCustomer.id}
          onClose={() => { setSelectedCustomer(null); fetchCustomers(); }}
        />
      )}
    </div>
  );
}
