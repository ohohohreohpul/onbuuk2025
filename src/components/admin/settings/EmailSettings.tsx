import { useState, useEffect } from 'react';
import { Mail, TestTube, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

interface EmailSettings {
  id?: string;
  business_id: string;
  provider: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  api_key?: string;
  from_email: string;
  from_name: string;
  is_verified: boolean;
}

export default function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [provider, setProvider] = useState<string>('resend');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
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
        .select('*')
        .eq('business_id', adminData.business_id)
        .maybeSingle();

      if (data) {
        setSettings(data);
        setProvider(data.provider);
        setFromEmail(data.from_email);
        setFromName(data.from_name);
        setApiKey(data.api_key || '');
        setSmtpHost(data.smtp_host || '');
        setSmtpPort(data.smtp_port || 587);
        setSmtpUsername(data.smtp_username || '');
        setSmtpPassword(data.smtp_password || '');
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
    if (!fromEmail || !fromName) {
      setMessage({ type: 'error', text: 'From Email and From Name are required' });
      return;
    }

    if (provider !== 'smtp' && !apiKey) {
      setMessage({ type: 'error', text: 'API Key is required for this provider' });
      return;
    }

    if (provider === 'smtp' && (!smtpHost || !smtpUsername || !smtpPassword)) {
      setMessage({ type: 'error', text: 'SMTP Host, Username, and Password are required' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const settingsData = {
        business_id: businessId,
        provider,
        from_email: fromEmail,
        from_name: fromName,
        api_key: provider !== 'smtp' ? apiKey : null,
        smtp_host: provider === 'smtp' ? smtpHost : null,
        smtp_port: provider === 'smtp' ? smtpPort : null,
        smtp_username: provider === 'smtp' ? smtpUsername : null,
        smtp_password: provider === 'smtp' ? smtpPassword : null,
      };

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
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save email settings' });
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
    } catch (err: any) {
      console.error('Error testing connection:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to send test email' });
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
            <option value="smtp">SMTP (Coming Soon)</option>
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
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'mailgun'
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
                  placeholder="smtp.example.com"
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                  placeholder="587"
                  disabled
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
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  disabled
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                SMTP support is coming soon. Please use Resend, SendGrid, or Mailgun for now.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || provider === 'smtp'}
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
