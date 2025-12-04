import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Mail, Power, Send, Eye, CheckCircle, XCircle, Clock, AlertCircle, EyeOff } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';

interface EmailSettings {
  emails_enabled: boolean;
  from_name: string | null;
  from_email: string | null;
  reply_to_email: string | null;
  send_booking_confirmations: boolean;
  send_booking_reminders: boolean;
  send_booking_cancellations: boolean;
  send_thank_you_emails: boolean;
  reminder_hours_before: number;
  provider: string;
  provider_configured: boolean;
  api_key: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_secure: boolean;
}

interface EmailEvent {
  event_key: string;
  event_name: string;
  event_description: string;
  category: string;
}

interface EmailLog {
  id: string;
  event_key: string;
  recipient_email: string;
  subject: string;
  status: string;
  sent_at: string;
  error_message: string | null;
}

type Provider = 'not_configured' | 'resend' | 'sendgrid' | 'mailgun' | 'postmark' | 'brevo' | 'smtp';

export default function CustomerEmails() {
  const { businessId } = useTenant();
  const [settings, setSettings] = useState<EmailSettings>({
    emails_enabled: false,
    from_name: null,
    from_email: null,
    reply_to_email: null,
    send_booking_confirmations: true,
    send_booking_reminders: true,
    send_booking_cancellations: true,
    send_thank_you_emails: false,
    reminder_hours_before: 24,
    provider: 'not_configured',
    provider_configured: false,
    api_key: null,
    smtp_host: null,
    smtp_port: 587,
    smtp_username: null,
    smtp_password: null,
    smtp_secure: false,
  });
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'setup' | 'events' | 'logs'>('setup');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadData();
  }, [businessId]);

  const loadData = async () => {
    if (!businessId) return;

    setLoading(true);
    try {
      const [settingsRes, eventsRes, logsRes] = await Promise.all([
        supabase
          .from('business_email_settings')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle(),
        supabase
          .from('business_email_events')
          .select('*')
          .order('category'),
        supabase
          .from('business_email_logs')
          .select('*')
          .eq('business_id', businessId)
          .order('sent_at', { ascending: false })
          .limit(20),
      ]);

      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
      if (eventsRes.data) {
        setEvents(eventsRes.data);
      }
      if (logsRes.data) {
        setLogs(logsRes.data);
      }
    } catch (error) {
      console.error('Error loading email data:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async () => {
    if (!businessId) return;

    if (settings.provider !== 'not_configured' && !settings.from_email) {
      showMessage('error', 'From Email is required');
      return;
    }

    if (settings.provider !== 'not_configured' && settings.provider !== 'smtp' && !settings.api_key) {
      showMessage('error', 'API Key is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_email_settings')
        .upsert({
          business_id: businessId,
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      showMessage('success', 'Settings saved successfully');
      await loadData();
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!testEmail) {
      showMessage('error', 'Please enter a test email address');
      return;
    }

    if (settings.provider === 'not_configured') {
      showMessage('error', 'Please select an email provider first');
      return;
    }

    setTesting(true);
    try {
      const response = await supabase.functions.invoke('test-email-connection', {
        body: {
          settings,
          testEmail,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to test connection');
      }

      if (response.data?.success) {
        showMessage('success', `Test email sent successfully to ${testEmail}!`);

        await supabase
          .from('business_email_settings')
          .update({
            provider_configured: true,
            last_test_at: new Date().toISOString(),
            last_test_status: 'success',
          })
          .eq('business_id', businessId);

        setSettings({ ...settings, provider_configured: true });
      } else {
        throw new Error(response.data?.error || 'Test failed');
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      showMessage('error', error.message || 'Failed to send test email');

      await supabase
        .from('business_email_settings')
        .update({
          provider_configured: false,
          last_test_at: new Date().toISOString(),
          last_test_status: 'failed',
        })
        .eq('business_id', businessId);
    } finally {
      setTesting(false);
    }
  };

  const getProviderInfo = (provider: Provider) => {
    const info = {
      not_configured: {
        name: 'Not Configured',
        description: 'Select an email provider to get started',
        setupLink: '',
      },
      resend: {
        name: 'Resend',
        description: 'Modern email API for developers',
        setupLink: 'https://resend.com/api-keys',
      },
      sendgrid: {
        name: 'SendGrid',
        description: 'Twilio SendGrid email service',
        setupLink: 'https://app.sendgrid.com/settings/api_keys',
      },
      mailgun: {
        name: 'Mailgun',
        description: 'Powerful email automation',
        setupLink: 'https://app.mailgun.com/app/account/security/api_keys',
      },
      postmark: {
        name: 'Postmark',
        description: 'Email delivery for web apps',
        setupLink: 'https://account.postmarkapp.com/servers',
      },
      brevo: {
        name: 'Brevo (Sendinblue)',
        description: 'Marketing and transactional email',
        setupLink: 'https://app.brevo.com/settings/keys/api',
      },
      smtp: {
        name: 'SMTP',
        description: 'Custom SMTP server',
        setupLink: '',
      },
    };
    return info[provider];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return <div className="text-stone-600">Loading...</div>;
  }

  const providerInfo = getProviderInfo(settings.provider as Provider);
  const requiresApiKey = settings.provider !== 'not_configured' && settings.provider !== 'smtp';
  const isMailgun = settings.provider === 'mailgun';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-stone-800">Customer Emails</h2>
          <p className="text-stone-600 mt-1">Configure your own email provider for customer communications</p>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-stone-600" />
          <span className={`px-3 py-1 text-sm font-semibold ${settings.provider_configured ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {settings.provider_configured ? 'Configured' : 'Not Configured'}
          </span>
        </div>
      </div>

      {!settings.provider_configured && (
        <div className="p-4 bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Email Provider Required</p>
            <p className="text-sm text-amber-800 mt-1">
              You need to configure your own email provider to send emails to customers. This ensures you maintain control over deliverability and costs.
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-4 ${message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border flex items-start gap-2`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          )}
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>{message.text}</p>
        </div>
      )}

      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('setup')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'setup'
              ? 'border-b-2 border-stone-800 text-stone-900'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Provider Setup
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'events'
              ? 'border-b-2 border-stone-800 text-stone-900'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Email Events
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'logs'
              ? 'border-b-2 border-stone-800 text-stone-900'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          Email History
        </button>
      </div>

      {activeTab === 'setup' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Email Provider *
            </label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value, provider_configured: false })}
              className="w-full px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
            >
              <option value="not_configured">Select a provider...</option>
              <option value="resend">Resend</option>
              <option value="sendgrid">SendGrid</option>
              <option value="mailgun">Mailgun</option>
              <option value="postmark">Postmark</option>
              <option value="brevo">Brevo (Sendinblue)</option>
            </select>
            {settings.provider !== 'not_configured' && (
              <p className="text-sm text-stone-600 mt-2">
                {providerInfo.description}
                {providerInfo.setupLink && (
                  <>
                    {' • '}
                    <a
                      href={providerInfo.setupLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-800 underline hover:text-stone-600"
                    >
                      Get API Key
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

          {settings.provider !== 'not_configured' && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={settings.from_name || ''}
                    onChange={(e) => setSettings({ ...settings, from_name: e.target.value || null })}
                    className="w-full px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
                    placeholder="Your Business Name"
                  />
                  <p className="text-xs text-stone-500 mt-1">Defaults to your business name</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    From Email *
                  </label>
                  <input
                    type="email"
                    value={settings.from_email || ''}
                    onChange={(e) => setSettings({ ...settings, from_email: e.target.value || null })}
                    className="w-full px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
                    placeholder="noreply@yourbusiness.com"
                    required
                  />
                  <p className="text-xs text-stone-500 mt-1">Must be verified with your provider</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Reply-To Email
                </label>
                <input
                  type="email"
                  value={settings.reply_to_email || ''}
                  onChange={(e) => setSettings({ ...settings, reply_to_email: e.target.value || null })}
                  className="w-full px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
                  placeholder="info@yourbusiness.com"
                />
                <p className="text-xs text-stone-500 mt-1">Where customers can reply</p>
              </div>

              {requiresApiKey && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    API Key *
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.api_key || ''}
                      onChange={(e) => setSettings({ ...settings, api_key: e.target.value || null })}
                      className="w-full px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800 pr-10"
                      placeholder={`Your ${providerInfo.name} API key`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    Your API key is stored securely and never shared
                  </p>
                </div>
              )}

              {isMailgun && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Mailgun Domain *
                  </label>
                  <input
                    type="text"
                    value={settings.smtp_host || ''}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value || null })}
                    className="w-full px-4 py-2 border border-stone-200 focus:outline-none focus:border-stone-800"
                    placeholder="mg.yourdomain.com"
                    required
                  />
                  <p className="text-xs text-stone-500 mt-1">Your verified Mailgun sending domain</p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-medium text-stone-800 mb-4">Email Types</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 border border-stone-200 hover:bg-stone-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-stone-900">Booking Confirmations</p>
                      <p className="text-sm text-stone-600">Sent immediately when customer books</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.send_booking_confirmations}
                      onChange={(e) => setSettings({ ...settings, send_booking_confirmations: e.target.checked })}
                      className="w-5 h-5 rounded border-stone-300"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border border-stone-200 hover:bg-stone-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-stone-900">Booking Reminders</p>
                      <p className="text-sm text-stone-600">Sent 24 hours before appointment</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.send_booking_reminders}
                      onChange={(e) => setSettings({ ...settings, send_booking_reminders: e.target.checked })}
                      className="w-5 h-5 rounded border-stone-300"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border border-stone-200 hover:bg-stone-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-stone-900">Cancellation Notifications</p>
                      <p className="text-sm text-stone-600">Sent when booking is cancelled</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.send_booking_cancellations}
                      onChange={(e) => setSettings({ ...settings, send_booking_cancellations: e.target.checked })}
                      className="w-5 h-5 rounded border-stone-300"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border border-stone-200 hover:bg-stone-50 cursor-pointer">
                    <div>
                      <p className="font-medium text-stone-900">Thank You Emails</p>
                      <p className="text-sm text-stone-600">Sent after appointment completion</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.send_thank_you_emails}
                      onChange={(e) => setSettings({ ...settings, send_thank_you_emails: e.target.checked })}
                      className="w-5 h-5 rounded border-stone-300"
                    />
                  </label>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Test Your Configuration</h4>
                <p className="text-sm text-blue-800 mb-4">
                  Send a test email to verify your provider is configured correctly
                </p>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 px-4 py-2 border border-blue-200 focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={handleTestConnection}
                    disabled={!testEmail || testing}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                    {testing ? 'Testing...' : 'Test'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.emails_enabled}
                    onChange={(e) => setSettings({ ...settings, emails_enabled: e.target.checked })}
                    className="w-5 h-5 rounded border-stone-300"
                    disabled={!settings.provider_configured}
                  />
                  <span className="text-sm font-medium text-stone-900">
                    Enable Customer Emails
                    {!settings.provider_configured && ' (requires successful test)'}
                  </span>
                </label>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.event_key} className="p-4 border border-stone-200 hover:bg-stone-50">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-stone-900">{event.event_name}</h4>
                  <p className="text-sm text-stone-600 mt-1">{event.event_description}</p>
                  <span className="inline-block mt-2 px-2 py-1 text-xs bg-stone-100 text-stone-700 capitalize">
                    {event.category}
                  </span>
                </div>
                <Power className="w-5 h-5 text-green-600" />
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          {logs.length === 0 ? (
            <p className="text-center py-8 text-stone-500">No emails sent yet</p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-4 border border-stone-200 hover:bg-stone-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(log.status)}
                        <span className={`px-2 py-1 text-xs font-semibold ${getStatusColor(log.status)}`}>
                          {log.status.toUpperCase()}
                        </span>
                        <span className="text-sm text-stone-600">•</span>
                        <span className="text-sm text-stone-600 capitalize">{log.event_key.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="font-medium text-stone-900">{log.subject}</p>
                      <p className="text-sm text-stone-600">To: {log.recipient_email}</p>
                      {log.error_message && (
                        <p className="text-sm text-red-600 mt-1">{log.error_message}</p>
                      )}
                    </div>
                    <span className="text-xs text-stone-500">
                      {new Date(log.sent_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
