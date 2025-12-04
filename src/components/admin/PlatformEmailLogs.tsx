import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';

interface EmailLog {
  id: string;
  event_key: string;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'failed' | 'queued' | 'pending';
  business_id: string | null;
  metadata: Record<string, any>;
  provider_email_id: string | null;
  sent_at: string;
  error_message: string | null;
}

export default function PlatformEmailLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    loadLogs();
    loadEvents();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_email_events')
        .select('event_key')
        .order('event_key');

      if (error) throw error;
      setEvents(data?.map(e => e.event_key) || []);
    } catch (err) {
      console.error('Error loading events:', err);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm ||
      log.recipient_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesEvent = eventFilter === 'all' || log.event_key === eventFilter;

    return matchesSearch && matchesStatus && matchesEvent;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
      case 'queued':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      queued: 'bg-blue-100 text-blue-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
    pending: logs.filter(l => l.status === 'pending' || l.status === 'queued').length,
  };

  if (loading) {
    return <div className="text-center py-8">Loading email logs...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Email Logs</h2>
          <p className="text-sm text-gray-600 mt-1">
            View all platform emails sent, including status and delivery information.
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total Emails</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-green-50 p-4 border border-green-200">
              <p className="text-sm text-green-600">Sent</p>
              <p className="text-2xl font-bold text-green-900">{stats.sent}</p>
            </div>
            <div className="bg-red-50 p-4 border border-red-200">
              <p className="text-sm text-red-600">Failed</p>
              <p className="text-2xl font-bold text-red-900">{stats.failed}</p>
            </div>
            <div className="bg-yellow-50 p-4 border border-yellow-200">
              <p className="text-sm text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by email or subject..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="queued">Queued</option>
            </select>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            >
              <option value="all">All Events</option>
              {events.map(event => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>
          </div>

          <div className="border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No email logs found
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className={`px-2 py-1 text-xs font-semibold ${getStatusBadge(log.status)}`}>
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.recipient_email}</div>
                        {log.provider_email_id && (
                          <div className="text-xs text-gray-500 font-mono">{log.provider_email_id}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600 font-mono">{log.event_key}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-md truncate">{log.subject}</div>
                        {log.error_message && (
                          <div className="text-xs text-red-600 mt-1">{log.error_message}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(log.sent_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > 0 && (
            <div className="mt-4 text-sm text-gray-600 text-center">
              Showing {filteredLogs.length} of {logs.length} emails (limited to last 100)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
