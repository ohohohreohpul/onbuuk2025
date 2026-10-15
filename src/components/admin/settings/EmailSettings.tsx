import { useState, useEffect, useRef } from 'react';
import { TestTube, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { SMTP_PORT, buildEmailSettingsPayload } from '../../../lib/emailSettingsPayload';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

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

type EmailSettingsText = {
  loadFailed: string; saved: string; saveFailed: string; enterTestAddress: string; notAuthenticated: string;
  testFailed: string; testSent: string; loading: string; title: string; subtitle: string; provider: string;
  resendRecommended: string; smtpOption: string; providerHint: string; fromEmail: string; fromName: string;
  fromNamePlaceholder: string; apiKey: string; mailgunFormatSuffix: string; savedKeepEmpty: string;
  enterApiKey: string; resendHint: string; sendgridHint: string; mailgunHint: string; smtpHost: string;
  smtpPort: string; smtpUsername: string; smtpPassword: string; mailboxPassword: string; portHintBefore: string;
  portHintAfter: string; usernameHint: string; appPassword: string; saving: string; saveSettings: string;
  testTitle: string; testHint: string; testPlaceholder: string; sending: string; sendTest: string;
  errFromRequired: string; errApiKeyRequired: string; errSmtpRequired: string; errPort: string; errPassword: string;
};

const TEXT: Translations<EmailSettingsText> = {
  en: {
    loadFailed: 'Failed to load email settings', saved: 'Email settings saved successfully!',
    saveFailed: 'Failed to save email settings', enterTestAddress: 'Please enter a test email address',
    notAuthenticated: 'Not signed in', testFailed: 'Failed to send test email', testSent: 'Test email sent successfully to {email}!',
    loading: 'Loading email settings...', title: 'Email Settings', subtitle: 'Configure your email provider to send emails to customers',
    provider: 'Email Provider', resendRecommended: 'Resend (Recommended)', smtpOption: 'SMTP – own mailbox (e.g. Strato, IONOS)',
    providerHint: 'Choose your email service provider. Resend is recommended for its simplicity and reliability.',
    fromEmail: 'From Email', fromName: 'From Name', fromNamePlaceholder: 'Your Business Name', apiKey: 'API Key',
    mailgunFormatSuffix: ' (Format: domain:apikey)', savedKeepEmpty: 'Saved – leave empty to keep it', enterApiKey: 'Enter your API key',
    resendHint: 'Get your API key from resend.com/api-keys', sendgridHint: 'Get your API key from SendGrid dashboard',
    mailgunHint: 'Format: your-domain.com:your-api-key', smtpHost: 'SMTP Host', smtpPort: 'SMTP Port',
    smtpUsername: 'SMTP Username', smtpPassword: 'SMTP Password', mailboxPassword: 'Mailbox password',
    portHintBefore: 'Use port', portHintAfter: '(SSL). Ports 25 and 587 are blocked on our servers.',
    usernameHint: 'User name is usually the full email address.', appPassword: 'app password',
    saving: 'Saving...', saveSettings: 'Save Settings', testTitle: 'Test Email Connection',
    testHint: 'Send a test email to verify your configuration is working correctly.', testPlaceholder: 'Enter test email address',
    sending: 'Sending...', sendTest: 'Send Test Email',
    errFromRequired: 'From Email and From Name are required.', errApiKeyRequired: 'API Key is required for this provider.',
    errSmtpRequired: 'SMTP server and user name are required.', errPort: 'Use port {port} (SSL). Ports 25 and 587 are blocked on our servers.',
    errPassword: 'Enter the mailbox password.',
  },
  de: {
    loadFailed: 'E-Mail-Einstellungen konnten nicht geladen werden', saved: 'E-Mail-Einstellungen gespeichert.',
    saveFailed: 'E-Mail-Einstellungen konnten nicht gespeichert werden', enterTestAddress: 'Bitte eine Adresse für die Test-E-Mail eingeben',
    notAuthenticated: 'Nicht angemeldet', testFailed: 'Test-E-Mail konnte nicht gesendet werden', testSent: 'Test-E-Mail an {email} gesendet.',
    loading: 'E-Mail-Einstellungen werden geladen...', title: 'E-Mail-Einstellungen', subtitle: 'E-Mail-Anbieter für den Versand an Kunden einrichten',
    provider: 'E-Mail-Anbieter', resendRecommended: 'Resend (empfohlen)', smtpOption: 'SMTP – eigenes Postfach (z. B. Strato, IONOS)',
    providerHint: 'E-Mail-Anbieter wählen. Resend ist einfach und zuverlässig und daher empfohlen.',
    fromEmail: 'Absender-E-Mail', fromName: 'Absendername', fromNamePlaceholder: 'Name Ihres Geschäfts', apiKey: 'API-Schlüssel',
    mailgunFormatSuffix: ' (Format: domain:apikey)', savedKeepEmpty: 'Gespeichert – leer lassen, um ihn zu behalten', enterApiKey: 'API-Schlüssel eingeben',
    resendHint: 'API-Schlüssel unter resend.com/api-keys abrufen', sendgridHint: 'API-Schlüssel im SendGrid-Dashboard abrufen',
    mailgunHint: 'Format: ihre-domain.de:ihr-api-schluessel', smtpHost: 'SMTP-Server', smtpPort: 'SMTP-Port',
    smtpUsername: 'SMTP-Benutzername', smtpPassword: 'SMTP-Passwort', mailboxPassword: 'Postfach-Passwort',
    portHintBefore: 'Port', portHintAfter: '(SSL) verwenden. Ports 25 und 587 sind auf unseren Servern gesperrt.',
    usernameHint: 'Der Benutzername ist meist die vollständige E-Mail-Adresse.', appPassword: 'App-Passwort',
    saving: 'Wird gespeichert...', saveSettings: 'Einstellungen speichern', testTitle: 'E-Mail-Verbindung testen',
    testHint: 'Test-E-Mail senden, um die Konfiguration zu prüfen.', testPlaceholder: 'Adresse für Test-E-Mail eingeben',
    sending: 'Wird gesendet...', sendTest: 'Test-E-Mail senden',
    errFromRequired: 'Absender-E-Mail und Absendername sind erforderlich.', errApiKeyRequired: 'Für diesen Anbieter ist ein API-Schlüssel erforderlich.',
    errSmtpRequired: 'SMTP-Server und Benutzername sind erforderlich.', errPort: 'Port {port} (SSL) verwenden. Ports 25 und 587 sind auf unseren Servern gesperrt.',
    errPassword: 'Bitte das Postfach-Passwort eingeben.',
  },
  th: {
    loadFailed: 'โหลดการตั้งค่าอีเมลไม่สำเร็จ', saved: 'บันทึกการตั้งค่าอีเมลแล้ว',
    saveFailed: 'บันทึกการตั้งค่าอีเมลไม่สำเร็จ', enterTestAddress: 'กรุณาใส่อีเมลสำหรับส่งอีเมลทดสอบ',
    notAuthenticated: 'ยังไม่ได้เข้าสู่ระบบ', testFailed: 'ส่งอีเมลทดสอบไม่สำเร็จ', testSent: 'ส่งอีเมลทดสอบไปที่ {email} แล้ว',
    loading: 'กำลังโหลดการตั้งค่าอีเมล...', title: 'การตั้งค่าอีเมล', subtitle: 'ตั้งค่าผู้ให้บริการอีเมลเพื่อส่งอีเมลถึงลูกค้า',
    provider: 'ผู้ให้บริการอีเมล', resendRecommended: 'Resend (แนะนำ)', smtpOption: 'SMTP – กล่องอีเมลของร้านเอง (เช่น Strato, IONOS)',
    providerHint: 'เลือกผู้ให้บริการอีเมล แนะนำ Resend เพราะใช้ง่ายและเสถียร',
    fromEmail: 'อีเมลผู้ส่ง', fromName: 'ชื่อผู้ส่ง', fromNamePlaceholder: 'ชื่อร้านของคุณ', apiKey: 'API Key',
    mailgunFormatSuffix: ' (รูปแบบ: domain:apikey)', savedKeepEmpty: 'บันทึกไว้แล้ว – เว้นว่างไว้เพื่อใช้ค่าเดิม', enterApiKey: 'ใส่ API Key',
    resendHint: 'รับ API Key ได้ที่ resend.com/api-keys', sendgridHint: 'รับ API Key ได้จากแดชบอร์ด SendGrid',
    mailgunHint: 'รูปแบบ: your-domain.com:your-api-key', smtpHost: 'เซิร์ฟเวอร์ SMTP', smtpPort: 'พอร์ต SMTP',
    smtpUsername: 'ชื่อผู้ใช้ SMTP', smtpPassword: 'รหัสผ่าน SMTP', mailboxPassword: 'รหัสผ่านกล่องอีเมล',
    portHintBefore: 'ใช้พอร์ต', portHintAfter: '(SSL) พอร์ต 25 และ 587 ถูกบล็อกบนเซิร์ฟเวอร์ของเรา',
    usernameHint: 'ชื่อผู้ใช้มักเป็นอีเมลเต็ม', appPassword: 'รหัสผ่านแอป',
    saving: 'กำลังบันทึก...', saveSettings: 'บันทึกการตั้งค่า', testTitle: 'ทดสอบการเชื่อมต่ออีเมล',
    testHint: 'ส่งอีเมลทดสอบเพื่อตรวจสอบว่าการตั้งค่าใช้งานได้', testPlaceholder: 'ใส่อีเมลสำหรับทดสอบ',
    sending: 'กำลังส่ง...', sendTest: 'ส่งอีเมลทดสอบ',
    errFromRequired: 'ต้องระบุอีเมลผู้ส่งและชื่อผู้ส่ง', errApiKeyRequired: 'ผู้ให้บริการนี้ต้องใช้ API Key',
    errSmtpRequired: 'ต้องระบุเซิร์ฟเวอร์ SMTP และชื่อผู้ใช้', errPort: 'ใช้พอร์ต {port} (SSL) พอร์ต 25 และ 587 ถูกบล็อกบนเซิร์ฟเวอร์ของเรา',
    errPassword: 'กรุณาใส่รหัสผ่านกล่องอีเมล',
  },
};

/** Validation messages from buildEmailSettingsPayload come in English; map the known ones. */
function translatePayloadError(error: string, t: EmailSettingsText): string {
  const known: Record<string, string> = {
    'From Email and From Name are required.': t.errFromRequired,
    'API Key is required for this provider.': t.errApiKeyRequired,
    'SMTP server and user name are required.': t.errSmtpRequired,
    [`Use port ${SMTP_PORT} (SSL). Ports 25 and 587 are blocked on our servers.`]: fillText(t.errPort, { port: SMTP_PORT }),
    'Enter the mailbox password.': t.errPassword,
  };
  return known[error] ?? error;
}

export default function EmailSettings() {
  const { t } = useAdminText(TEXT);
  const textRef = useRef(t);
  textRef.current = t;
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
      setMessage({ type: 'error', text: textRef.current.loadFailed });
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
      setMessage({ type: 'error', text: translatePayloadError(result.error, t) });
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

      setMessage({ type: 'success', text: t.saved });
      await loadBusinessAndSettings();
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: err instanceof Error && err.message ? err.message : t.saveFailed });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!businessId || !testEmail) {
      setMessage({ type: 'error', text: t.enterTestAddress });
      return;
    }

    setIsTesting(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t.notAuthenticated);

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
        throw new Error(result.error || t.testFailed);
      }

      setMessage({ type: 'success', text: fillText(t.testSent, { email: testEmail }) });
    } catch (err) {
      console.error('Error testing connection:', err);
      setMessage({ type: 'error', text: err instanceof Error && err.message ? err.message : t.testFailed });
    } finally {
      setIsTesting(false);
    }
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
          <Label htmlFor="provider">{t.provider}</Label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
          >
            <option value="resend">{t.resendRecommended}</option>
            <option value="sendgrid">SendGrid</option>
            <option value="mailgun">Mailgun</option>
            <option value="smtp">{t.smtpOption}</option>
          </select>
          <p className="mt-1 text-sm text-stone-500">
            {t.providerHint}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="from_email">{t.fromEmail}</Label>
            <Input
              id="from_email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="noreply@yourdomain.com"
            />
          </div>

          <div>
            <Label htmlFor="from_name">{t.fromName}</Label>
            <Input
              id="from_name"
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder={t.fromNamePlaceholder}
            />
          </div>
        </div>

        {provider !== 'smtp' && (
          <div>
            <Label htmlFor="api_key">
              {t.apiKey}
              {provider === 'mailgun' && t.mailgunFormatSuffix}
            </Label>
            <Input
              id="api_key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                settings?.has_api_key
                  ? t.savedKeepEmpty
                  : provider === 'mailgun'
                    ? 'yourdomain.com:key-xxxxxxxxxx'
                    : t.enterApiKey
              }
            />
            <p className="mt-1 text-sm text-stone-500">
              {provider === 'resend' && t.resendHint}
              {provider === 'sendgrid' && t.sendgridHint}
              {provider === 'mailgun' && t.mailgunHint}
            </p>
          </div>
        )}

        {provider === 'smtp' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp_host">{t.smtpHost}</Label>
                <Input
                  id="smtp_host"
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.strato.de"
                />
              </div>

              <div>
                <Label htmlFor="smtp_port">{t.smtpPort}</Label>
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
                <Label htmlFor="smtp_username">{t.smtpUsername}</Label>
                <Input
                  id="smtp_username"
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="info@yourshop.de"
                />
              </div>

              <div>
                <Label htmlFor="smtp_password">{t.smtpPassword}</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  autoComplete="new-password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={settings?.has_smtp_password ? t.savedKeepEmpty : t.mailboxPassword}
                />
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              <p>
                {t.portHintBefore} <strong>465</strong> {t.portHintAfter}{' '}
                {t.usernameHint}
              </p>
              <p className="mt-1">
                Strato: <code>smtp.strato.de</code> · IONOS: <code>smtp.ionos.de</code> · Google Workspace: <code>smtp.gmail.com</code> ({t.appPassword})
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
            {isSaving ? t.saving : t.saveSettings}
          </Button>
        </div>
      </div>

      {settings && (
        <div className="border-t border-stone-200 pt-6">
          <h3 className="text-lg font-medium text-stone-800 mb-4">{t.testTitle}</h3>
          <p className="text-stone-600 mb-4">
            {t.testHint}
          </p>

          <div className="flex gap-4">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={t.testPlaceholder}
              className="max-w-md"
            />
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !testEmail}
              variant="outline"
            >
              <TestTube className="w-4 h-4 mr-2" />
              {isTesting ? t.sending : t.sendTest}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
