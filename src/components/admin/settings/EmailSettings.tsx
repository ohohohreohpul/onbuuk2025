import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';

interface EmailSetting {
  id?: string;
  provider: string;
  enabled: boolean;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  api_key: string;
}

export default function EmailSettings() {
  const { businessId } = useTenant();
  const [settings, setSettings] = useState<EmailSetting>({
    provider: 'smtp',
    enabled: false,
    from_email: '',
    from_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    api_key: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [businessId]);

  const fetchSettings = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('email_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    if (data) {
      setSettings(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    setSavedMessage('');

    try {
      const payload = {
        business_id: businessId,
        ...settings,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('email_settings')
        .upsert(payload);

      if (error) throw error;

      setSavedMessage('Email settings saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error saving email settings:', error);
      alert('Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-stone-600">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded">
        <div className="flex items-center space-x-3">
          <Mail className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">Email Notifications</p>
            <p className="text-sm text-blue-700">
              {settings.enabled ? 'Active' : 'Inactive'} • Connect your email provider to send booking confirmations
            </p>
          </div>
        </div>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            className="w-5 h-5 rounded border-stone-300"
          />
          <span className="text-sm font-medium text-blue-900">Enable</span>
        </label>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4">Email Provider</h3>
        <select
          value={settings.provider}
          onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
          className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
        >
          <option value="smtp">Custom SMTP</option>
          <option value="resend">Resend</option>
          <option value="sendgrid">SendGrid</option>
          <option value="mailgun">Mailgun</option>
          <option value="brevo">Brevo (Sendinblue)</option>
        </select>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4">Sender Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              From Name
            </label>
            <input
              type="text"
              value={settings.from_name}
              onChange={(e) => setSettings({ ...settings, from_name: e.target.value })}
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              placeholder="Your Business Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              From Email
            </label>
            <input
              type="email"
              value={settings.from_email}
              onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              placeholder="noreply@yourbusiness.com"
            />
          </div>
        </div>
      </div>

      {settings.provider === 'smtp' && (
        <div>
          <h3 className="text-lg font-medium text-stone-800 mb-4">SMTP Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                SMTP Host
              </label>
              <input
                type="text"
                value={settings.smtp_host}
                onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                placeholder="smtp.gmail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                SMTP Port
              </label>
              <input
                type="number"
                value={settings.smtp_port}
                onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 587 })}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={settings.smtp_username}
                onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={settings.smtp_password}
                  onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                  className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {settings.provider !== 'smtp' && (
        <div>
          <h3 className="text-lg font-medium text-stone-800 mb-4">API Configuration</h3>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.api_key}
                onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 pr-10"
                placeholder="Your API key from provider"
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
              Get your API key from your {settings.provider} dashboard
            </p>
          </div>
        </div>
      )}

      <div className="p-4 bg-amber-50 border border-amber-200 rounded">
        <p className="text-sm text-amber-800">
          <strong>Important:</strong> You need an active account with your chosen email provider. API keys and credentials are stored securely but you're responsible for any costs from your email provider.
        </p>
      </div>

      {savedMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{savedMessage}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
}
