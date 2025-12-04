import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, CheckCircle, AlertCircle, Send } from 'lucide-react';

interface EmailSettings {
  provider: string;
  api_key_configured: boolean;
  default_from_email: string;
  default_from_name: string;
  default_reply_to: string | null;
  daily_limit: number;
  rate_limit_per_minute: number;
}

export default function PlatformEmailSettings() {
  const [settings, setSettings] = useState<EmailSettings>({
    provider: 'resend',
    api_key_configured: true,
    default_from_email: 'noreply@noti.onbuuk.com',
    default_from_name: 'Buuk',
    default_reply_to: 'support@noti.onbuuk.com',
    daily_limit: 1000,
    rate_limit_per_minute: 60,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState({ sentToday: 0, totalSent: 0 });

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_email_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [{ count: todayCount }, { count: totalCount }] = await Promise.all([
        supabase
          .from('platform_email_logs')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', `${today}T00:00:00`)
          .lte('sent_at', `${today}T23:59:59`),
        supabase
          .from('platform_email_logs')
          .select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        sentToday: todayCount || 0,
        totalSent: totalCount || 0,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('platform_email_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      showMessage('success', 'Settings saved successfully');
    } catch (err) {
      console.error('Error saving settings:', err);
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;

    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke('send-platform-email', {
        body: {
          event_key: 'staff_invitation',
          recipient_email: testEmail,
          variables: {
            business_name: 'Test Business',
            staff_name: 'Test User',
            staff_email: testEmail,
            role: 'Admin',
            invite_url: 'https://example.com/test',
            invite_expires_at: 'December 31, 2024',
          },
        },
      });

      if (error) throw error;
      showMessage('success', `Test email sent to ${testEmail}`);
      setTestEmail('');
    } catch (err) {
      console.error('Error sending test email:', err);
      showMessage('error', 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Platform Email Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure your email provider and default settings for all platform emails.
          </p>
        </div>

        {message && (
          <div className={`px-6 py-3 ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {message.text}
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 border border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Sent Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.sentToday}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Daily Limit</p>
              <p className="text-2xl font-bold text-gray-900">{settings.daily_limit}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Sent</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSent}</p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              Email Provider
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold">ACTIVE</span>
            </label>
            <input
              type="text"
              value={settings.provider}
              disabled
              className="w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Currently using Resend for email delivery</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              API Key Status
              {settings.api_key_configured && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  CONFIGURED
                </span>
              )}
            </label>
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 bg-gray-50">
              <code className="text-sm text-gray-600">re_QKqd96h9_2Jff••••••••••••••••••</code>
            </div>
            <p className="text-xs text-gray-500 mt-1">API key is stored securely in environment variables</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default From Name</label>
              <input
                type="text"
                value={settings.default_from_name}
                onChange={(e) => setSettings({ ...settings, default_from_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default From Email</label>
              <input
                type="email"
                value={settings.default_from_email}
                onChange={(e) => setSettings({ ...settings, default_from_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Reply-To Email (Optional)
            </label>
            <input
              type="email"
              value={settings.default_reply_to || ''}
              onChange={(e) => setSettings({ ...settings, default_reply_to: e.target.value || null })}
              placeholder="support@noti.onbuuk.com"
              className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Daily Send Limit</label>
              <input
                type="number"
                value={settings.daily_limit}
                onChange={(e) => setSettings({ ...settings, daily_limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum emails per day across all events</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rate Limit (per minute)</label>
              <input
                type="number"
                value={settings.rate_limit_per_minute}
                onChange={(e) => setSettings({ ...settings, rate_limit_per_minute: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum emails per minute</p>
            </div>
          </div>

          <div className="pt-6 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Test Email Configuration</h3>
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email address to test"
                className="flex-1 px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              />
              <button
                onClick={handleTestEmail}
                disabled={!testEmail || testing}
                className="flex items-center gap-2 px-6 py-2 bg-slate-700 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {testing ? 'Sending...' : 'Send Test'}
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">Sends a test staff invitation email to verify configuration</p>
          </div>
        </div>
      </div>
    </div>
  );
}
