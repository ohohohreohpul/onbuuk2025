import { useState, useEffect } from 'react';
import { Mail, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Input } from '../../ui/input';
import DOMPurify from 'isomorphic-dompurify';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';

interface EmailLog {
  id: string;
  business_id: string;
  customer_id: string | null;
  to_email: string;
  from_email: string;
  subject: string;
  body: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

const TEXT: Translations<{
  loading: string; title: string; subtitle: string; searchPlaceholder: string; allStatus: string; sent: string;
  failed: string; pending: string; noEmails: string; noMatches: string; status: string; recipient: string;
  subject: string; date: string; actions: string; viewDetails: string; details: string; close: string;
  from: string; to: string; error: string; body: string;
}> = {
  en: {
    loading: 'Loading email logs...', title: 'Email Logs', subtitle: 'View all emails sent to your customers',
    searchPlaceholder: 'Search by recipient or subject...', allStatus: 'All Status', sent: 'Sent', failed: 'Failed',
    pending: 'Pending', noEmails: 'No emails sent yet', noMatches: 'No emails match your filters', status: 'Status',
    recipient: 'Recipient', subject: 'Subject', date: 'Date', actions: 'Actions', viewDetails: 'View Details',
    details: 'Email Details', close: 'Close', from: 'From', to: 'To', error: 'Error', body: 'Email Body',
  },
  de: {
    loading: 'E-Mail-Protokoll wird geladen...', title: 'E-Mail-Protokoll', subtitle: 'Alle an Ihre Kunden gesendeten E-Mails',
    searchPlaceholder: 'Nach Empfänger oder Betreff suchen...', allStatus: 'Alle Status', sent: 'Gesendet', failed: 'Fehlgeschlagen',
    pending: 'Ausstehend', noEmails: 'Noch keine E-Mails gesendet', noMatches: 'Keine E-Mails passen zu den Filtern', status: 'Status',
    recipient: 'Empfänger', subject: 'Betreff', date: 'Datum', actions: 'Aktionen', viewDetails: 'Details anzeigen',
    details: 'E-Mail-Details', close: 'Schließen', from: 'Von', to: 'An', error: 'Fehler', body: 'E-Mail-Inhalt',
  },
  th: {
    loading: 'กำลังโหลดประวัติอีเมล...', title: 'ประวัติอีเมล', subtitle: 'ดูอีเมลทั้งหมดที่ส่งถึงลูกค้าของคุณ',
    searchPlaceholder: 'ค้นหาตามผู้รับหรือหัวเรื่อง...', allStatus: 'ทุกสถานะ', sent: 'ส่งแล้ว', failed: 'ส่งไม่สำเร็จ',
    pending: 'รอส่ง', noEmails: 'ยังไม่มีอีเมลที่ส่ง', noMatches: 'ไม่มีอีเมลที่ตรงกับตัวกรอง', status: 'สถานะ',
    recipient: 'ผู้รับ', subject: 'หัวเรื่อง', date: 'วันที่', actions: 'การดำเนินการ', viewDetails: 'ดูรายละเอียด',
    details: 'รายละเอียดอีเมล', close: 'ปิด', from: 'จาก', to: 'ถึง', error: 'ข้อผิดพลาด', body: 'เนื้อหาอีเมล',
  },
};

export default function EmailLogs() {
  const { t, locale } = useAdminText(TEXT);
  const statusLabel = (status: string): string => {
    if (status === 'sent') return t.sent;
    if (status === 'failed') return t.failed;
    if (status === 'pending') return t.pending;
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [searchTerm, statusFilter, logs]);

  const loadLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminData } = await supabase
        .from('admin_users')
        .select('business_id')
        .eq('email', user.email)
        .single();

      if (!adminData) return;

      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('business_id', adminData.business_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error loading email logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((log) => log.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.to_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <Mail className="w-5 h-5 text-stone-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'sent':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-stone-100 text-stone-800`;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-stone-600">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-light text-stone-800 mb-2">{t.title}</h2>
        <p className="text-stone-600">{t.subtitle}</p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 w-4 h-4" />
          <Input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
        >
          <option value="all">{t.allStatus}</option>
          <option value="sent">{t.sent}</option>
          <option value="failed">{t.failed}</option>
          <option value="pending">{t.pending}</option>
        </select>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-stone-300 rounded-lg">
          <Mail className="w-12 h-12 text-stone-400 mx-auto mb-4" />
          <p className="text-stone-600">
            {logs.length === 0 ? t.noEmails : t.noMatches}
          </p>
        </div>
      ) : (
        <div className="border border-stone-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t.status}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t.recipient}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t.subject}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t.date}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className={getStatusBadge(log.status)}>
                        {statusLabel(log.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-stone-900">{log.to_email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-stone-900 max-w-md truncate">
                      {log.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-stone-500">
                      {formatDate(log.sent_at || log.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-sm text-stone-600 hover:text-stone-900 underline"
                    >
                      {t.viewDetails}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-xl font-medium text-stone-800">{t.details}</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-stone-400 hover:text-stone-600"
                aria-label={t.close}
                title={t.close}
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedLog.status)}
                <span className={getStatusBadge(selectedLog.status)}>
                  {statusLabel(selectedLog.status)}
                </span>
              </div>

              <div>
                <div className="text-sm font-medium text-stone-500">{t.from}</div>
                <div className="text-stone-900">{selectedLog.from_email}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-stone-500">{t.to}</div>
                <div className="text-stone-900">{selectedLog.to_email}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-stone-500">{t.subject}</div>
                <div className="text-stone-900">{selectedLog.subject}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-stone-500">{t.date}</div>
                <div className="text-stone-900">
                  {formatDate(selectedLog.sent_at || selectedLog.created_at)}
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <div className="text-sm font-medium text-red-600">{t.error}</div>
                  <div className="text-red-800 bg-red-50 p-3 rounded-lg mt-1">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-stone-500 mb-2">{t.body}</div>
                <div
                  className="border border-stone-200 rounded-lg p-4 bg-stone-50 text-sm"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedLog.body) }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
