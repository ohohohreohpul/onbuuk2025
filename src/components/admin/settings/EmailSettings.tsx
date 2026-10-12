import { useState, useEffect } from 'react';
import { TestTube, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { SMTP_PORT, buildEmailSettingsPayload } from '../../../lib/emailSettingsPayload';

interface EmailSettings {
  id?: string;
  business_id: string;
  provider: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  from_email: string;
  from_name: string;
  is_verified: boolean;
  /** Secrets are write-only; these say whether one is stored. */
  has_api_key: boolean;
  has_smtp_password: boolean;
}

const EMAIL_SETTINGS_COLUMNS =
  'id, business_id, provider, smtp_host, smtp_port, smtp_username, from_email, from_name, is_verified, has_api_key, has_smtp_password';

export default function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [provider, setProvider] = useState<string>('resend');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(SMTP_PORT);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    loadBusinessAndSettings();
  }, []);

  const loadBusinessAndSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminData } = await supabase
        .from('admin_users')
        .select('business_id')
        .eq('email', user.email)
        .single();

      if (!adminData) return;

      setBusinessId(adminData.business_id);

      const { data, error } = await supabase
        .from('email_settings')
        .select(EMAIL_SETTINGS_COLUMNS)
        .eq('business_id', adminData.business_id)
        .maybeSingle<EmailSettings>();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setProvider(data.provider);
        setFromEmail(data.from_email);
        setFromName(data.from_name);
        setApiKey('');
        setSmtpHost(data.smtp_host || '');
        setSmtpPort(data.smtp_port || SMTP_PORT);
        setSmtpUsername(data.smtp_username || '');
        setSmtpPassword('');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setMessage({ type: 'error', text: 'Failed to load email settings' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    const result = buildEmailSettingsPayload({
      provider,
      fromEmail,
      fromName,
      apiKey,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      hasApiKey: Boolean(settings?.has_api_key),
      hasSmtpPassword: Boolean(settings?.has_smtp_password),
    });
    if (!result.ok) {
      setMessage({ type: 'error', text: result.error });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const settingsData = { business_id: businessId, ...result.payload };

      if (settings?.id) {
        const { error } = await supabase
          .from('email_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_settings')
          .insert(settingsData);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Email settings saved successfully!' });
      await loadBusinessAndSettings();
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: err instanceof Error && err.message ? err.message : 'Failed to save email settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!businessId || !testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }

    setIsTesting(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-email-connection`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessId,
            testEmail,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send test email');
      }

      setMessage({ type: 'success', text: `Test email sent successfully to ${testEmail}!` });
    } catch (err) {
      console.error('Error testing connection:', err);
      setMessage({ type: 'error', text: err instanceof Error && err.message ? err.message : 'Failed to send test email' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-stone-600">Loading email settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-light text-stone-800 mb-2">Email Settings</h2>
        <p className="text-stone-600">Configure your email provider to send emails to customers</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="provider">Email Provider</Label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          >
            <option value="resend">Resend (Recommended)</option>
            <option value="sendgrid">SendGrid</option>
            <option value="mailgun">Mailgun</option>
            <option value="smtp">SMTP – own mailbox (e.g. Strato, IONOS)</option>
          </select>
          <p className="mt-1 text-sm text-stone-500">
            Choose your email service provider. Resend is recommended for its simplicity and reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="from_email">From Email</Label>
            <Input
              id="from_email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="noreply@yourdomain.com"
            />
          </div>

          <div>
            <Label htmlFor="from_name">From Name</Label>
            <Input
              id="from_name"
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Your Business Name"
            />
          </div>
        </div>

        {provider !== 'smtp' && (
          <div>
            <Label htmlFor="api_key">
              API Key
              {provider === 'mailgun' && ' (Format: domain:apikey)'}
            </Label>
            <Input
              id="api_key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                settings?.has_api_key
                  ? 'Saved – leave empty to keep it'
                  : provider === 'mailgun'
                    ? 'yourdomain.com:key-xxxxxxxxxx'
                    : 'Enter your API key'
              }
            />
            <p className="mt-1 text-sm text-stone-500">
              {provider === 'resend' && 'Get your API key from resend.com/api-keys'}
              {provider === 'sendgrid' && 'Get your API key from SendGrid dashboard'}
              {provider === 'mailgun' && 'Format: your-domain.com:your-api-key'}
            </p>
          </div>
        )}

        {provider === 'smtp' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.strato.de"
                />
              </div>

              <div>
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number.parseInt(e.target.value, 10) || SMTP_PORT)}
                  placeholder="465"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp_username">SMTP Username</Label>
                <Input
                  id="smtp_username"
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="info@yourshop.de"
                />
              </div>

              <div>
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  autoComplete="new-password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={settings?.has_smtp_password ? 'Saved – leave empty to keep it' : 'Mailbox password'}
                />
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              <p>
                Use port <strong>465</strong> (SSL). Ports 25 and 587 are blocked on our servers.
                User name is usually the full email address.
              </p>
              <p className="mt-1">
                Strato: <code>smtp.strato.de</code> · IONOS: <code>smtp.ionos.de</code> · Google Workspace: <code>smtp.gmail.com</code> (app password)
              </p>
            </div>
          </>
        )}

        <div className="flex gap-4">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-stone-900 hover:bg-stone-800 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {settings && (
        <div className="border-t border-stone-200 pt-6">
          <h3 className="text-lg font-medium text-stone-800 mb-4">Test Email Connection</h3>
          <p className="text-stone-600 mb-4">
            Send a test email to verify your configuration is working correctly.
          </p>

          <div className="flex gap-4">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter test email address"
              className="max-w-md"
            />
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !testEmail}
              variant="outline"
            >
              <TestTube className="w-4 h-4 mr-2" />
              {isTesting ? 'Sending...' : 'Send Test Email'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
