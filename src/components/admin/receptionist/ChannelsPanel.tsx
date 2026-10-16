import { useEffect, useState } from 'react';
import { Check, Copy, Globe, Loader2, Mail, MessageCircle, QrCode, ShieldCheck } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { callReceptionist, updateSettings, type ChannelMode, type Overview, type ReceptionistSettings } from './receptionistApi';
import { RECEPTIONIST_TEXT, type ReceptionistText } from './receptionistText';
import { openWidgetPreview } from './widgetPreview';


const QR_REFRESH_MS = 10_000;

export function Switch({ isOn, label, onChange, isDisabled }: { isOn: boolean; label: string; onChange: (on: boolean) => void; isDisabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={isOn} aria-label={label} disabled={isDisabled} onClick={() => onChange(!isOn)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${isOn ? 'bg-emerald-600' : 'bg-stone-300'}`}>
      <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function ModePicker({ mode, t, onChange }: { mode: ChannelMode; t: ReceptionistText; onChange: (mode: ChannelMode) => void }) {
  const tile = (isActive: boolean) => `rounded-2xl border p-3 text-left transition ${isActive ? 'border-[#1A1714] bg-white ring-2 ring-[#1A1714]' : 'border-stone-200 bg-white/70 hover:border-stone-400'}`;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => onChange('auto')} className={tile(mode === 'auto')}>
        <span className="block text-sm font-semibold text-[#1A1714]">{t.modeAuto}</span><span className="text-xs text-stone-500">{t.modeAutoHint}</span>
      </button>
      <button type="button" onClick={() => onChange('drafts')} className={tile(mode === 'drafts')}>
        <span className="block text-sm font-semibold text-[#1A1714]">{t.modeDrafts}</span><span className="text-xs text-stone-500">{t.modeDraftsHint}</span>
      </button>
    </div>
  );
}

function Card({ icon: Icon, title, hint, isOn, onToggle, t, children }: {
  icon: typeof Globe; title: string; hint: string; isOn: boolean; onToggle: (on: boolean) => void; t: ReceptionistText; children: React.ReactNode;
}) {
  return (
    <section className={`${ADMIN_SURFACE} space-y-4 p-6`}>
      <header className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]"><Icon className="h-5 w-5" /></span>
        <div className="flex-1">
          <h2 className="font-semibold text-[#1A1714]">{title}</h2>
          <p className="text-sm text-stone-500">{hint}</p>
        </div>
        <Switch isOn={isOn} label={t.channelOn} onChange={onToggle} />
      </header>
      {children}
    </section>
  );
}

interface ChannelsPanelProps {
  overview: Overview;
  onOverview: (overview: Overview) => void;
}

export default function ChannelsPanel({ overview, onOverview }: ChannelsPanelProps) {
  const { t, locale } = useAdminText(RECEPTIONIST_TEXT);
  const { settings, status } = overview;
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [greeting, setGreeting] = useState(settings.widget_greeting);
  const [color, setColor] = useState(settings.widget_color ?? '#1A1714');
  const isResend = status.mailbox?.provider === 'resend';
  const suggestedImap = status.mailbox?.smtpHost?.replace(/^smtp\./, 'imap.') ?? '';
  const [imap, setImap] = useState({ host: settings.imap_host ?? suggestedImap, port: String(settings.imap_port ?? 993), user: settings.imap_username ?? '', password: '' });
  const [wa, setWa] = useState({ phoneNumberId: '', token: '', appSecret: '' });
  const [waChoice, setWaChoice] = useState<'cloud_api' | 'qr_gateway'>(settings.whatsapp_provider ?? 'cloud_api');

  // WhatsApp rotates the pairing QR every ~30–60 s; keep the shown code fresh until it is scanned.
  useEffect(() => {
    if (settings.whatsapp_status !== 'pending_qr') return;
    const timer = window.setInterval(() => {
      callReceptionist<Overview>('overview').then(onOverview).catch((error) => console.error('QR refresh failed:', error));
    }, QR_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [settings.whatsapp_status, onOverview]);

  const save = async (patch: Partial<ReceptionistSettings>) => {
    setError(null);
    try {
      onOverview(await updateSettings(patch));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.saveFailed);
    }
  };

  const act = async (key: string, action: string, payload: Record<string, unknown> = {}) => {
    setIsBusy(key);
    setError(null);
    try {
      onOverview(await callReceptionist<Overview>(action, payload));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t.saveFailed);
    } finally {
      setIsBusy(null);
    }
  };

  const snippet = `<script src="${window.location.origin}/receptionist-widget.js" data-key="${settings.widget_key}" async></script>`;
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '–');

  const openPreview = () => openWidgetPreview(settings.widget_key);

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Card icon={Globe} title={t.webTitle} hint={t.webHint} isOn={settings.web_enabled} onToggle={(on) => save({ web_enabled: on })} t={t}>
        <div className="flex items-center gap-2 rounded-xl bg-stone-900/[0.04] p-3">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-stone-700">{snippet}</code>
          <button type="button" onClick={() => { navigator.clipboard.writeText(snippet); setIsCopied(true); }} className={`${ADMIN_SECONDARY_BUTTON} py-2`}>
            {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{isCopied ? t.copied : t.copy}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-sm text-stone-600">{t.greeting}
            <input value={greeting} onChange={(e) => setGreeting(e.target.value)} onBlur={() => greeting !== settings.widget_greeting && save({ widget_greeting: greeting })} maxLength={300} placeholder={t.greetingPlaceholder} className={`${ADMIN_INPUT} mt-1`} />
          </label>
          <label className="text-sm text-stone-600">{t.color}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} onBlur={() => save({ widget_color: color })} className="mt-1 block h-11 w-16 cursor-pointer rounded-xl border border-stone-200" />
          </label>
        </div>
        <ModePicker mode={settings.web_mode} t={t} onChange={(mode) => save({ web_mode: mode })} />
        <button type="button" onClick={openPreview} disabled={!settings.is_enabled || !settings.web_enabled} className={ADMIN_SECONDARY_BUTTON}>{t.preview}</button>
      </Card>

      <Card icon={Mail} title={t.emailTitle} hint={t.emailHint} isOn={settings.email_enabled} onToggle={(on) => save({ email_enabled: on })} t={t}>
        {!status.mailbox ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.mailboxMissing}</p>
        ) : (
          <>
            {!isResend && <p className="text-sm text-stone-600">{fillText(t.mailboxFound, { address: status.mailbox.address })}</p>}
            {settings.imap_host && (settings.imap_error
              ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{fillText(t.mailboxError, { error: settings.imap_error })}</p>
              : <p className="text-sm text-emerald-700">{fillText(t.mailboxConnected, { time: time(settings.imap_checked_at) })}</p>)}
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <label className="text-sm text-stone-600">{t.imapHost}<input value={imap.host} onChange={(e) => setImap({ ...imap, host: e.target.value })} placeholder="imap.strato.de" className={`${ADMIN_INPUT} mt-1`} /></label>
              <label className="text-sm text-stone-600">{t.imapPort}<input inputMode="numeric" value={imap.port} onChange={(e) => setImap({ ...imap, port: e.target.value })} className={`${ADMIN_INPUT} mt-1`} /></label>
              <label className="text-sm text-stone-600">{isResend ? t.readMailbox : t.imapUser}<input value={imap.user} onChange={(e) => setImap({ ...imap, user: e.target.value })} placeholder={isResend ? 'info@…' : t.imapUserHint} className={`${ADMIN_INPUT} mt-1`} autoComplete="off" /></label>
              <label className="text-sm text-stone-600">{t.imapPassword}<input type="password" value={imap.password} onChange={(e) => setImap({ ...imap, password: e.target.value })} placeholder={isResend ? '' : t.imapPasswordHint} className={`${ADMIN_INPUT} mt-1`} autoComplete="new-password" /></label>
            </div>
            <button type="button" disabled={isBusy !== null || !imap.host || (isResend && (!imap.user || (!imap.password && !settings.imap_host)))} onClick={() => act('email', 'connect_email', { imapHost: imap.host, imapPort: Number(imap.port), imapUsername: imap.user, imapPassword: imap.password })} className={ADMIN_PRIMARY_BUTTON}>
              {isBusy === 'email' && <Loader2 className="h-4 w-4 animate-spin" />}{isBusy === 'email' ? t.testingMailbox : t.connectMailbox}
            </button>
            <ModePicker mode={settings.email_mode} t={t} onChange={(mode) => save({ email_mode: mode })} />
          </>
        )}
      </Card>

      <Card icon={MessageCircle} title={t.waTitle} hint={t.waHint} isOn={settings.whatsapp_enabled} onToggle={(on) => save({ whatsapp_enabled: on })} t={t}>
        {settings.whatsapp_status === 'connected' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
            <span className="text-sm font-medium text-emerald-900">{fillText(t.waConnected, { phone: settings.whatsapp_display_phone ?? '' })}</span>
            <button type="button" disabled={isBusy !== null} onClick={() => act('wa', 'disconnect_whatsapp')} className={`${ADMIN_SECONDARY_BUTTON} py-2`}>{t.waDisconnect}</button>
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {([['cloud_api', ShieldCheck, t.waOfficial, t.waOfficialHint], ['qr_gateway', QrCode, t.waOwn, t.waOwnHint]] as const).map(([id, Icon, title, hint]) => (
                <button key={id} type="button" onClick={() => setWaChoice(id)}
                  className={`rounded-2xl border p-4 text-left transition ${waChoice === id ? 'border-[#1A1714] bg-white ring-2 ring-[#1A1714]' : 'border-stone-200 bg-white/70 hover:border-stone-400'}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#1A1714]"><Icon className="h-4 w-4" />{title}</span>
                  <span className="mt-1 block text-xs text-stone-500">{hint}</span>
                </button>
              ))}
            </div>
            {waChoice === 'cloud_api' ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-stone-600">{t.waPhoneId}<input value={wa.phoneNumberId} onChange={(e) => setWa({ ...wa, phoneNumberId: e.target.value })} inputMode="numeric" className={`${ADMIN_INPUT} mt-1`} /></label>
                  <label className="text-sm text-stone-600">{t.waAppSecret}<input type="password" value={wa.appSecret} onChange={(e) => setWa({ ...wa, appSecret: e.target.value })} placeholder={t.waAppSecretHint} className={`${ADMIN_INPUT} mt-1`} autoComplete="off" /></label>
                </div>
                <label className="block text-sm text-stone-600">{t.waToken}<input type="password" value={wa.token} onChange={(e) => setWa({ ...wa, token: e.target.value })} className={`${ADMIN_INPUT} mt-1`} autoComplete="off" /></label>
                <p className="text-xs text-stone-500">{t.waWebhookHint} <code className="select-all">{window.location.origin}/api/receptionist/whatsapp</code></p>
                <button type="button" disabled={isBusy !== null || !wa.phoneNumberId || !wa.token} onClick={() => act('wa', 'connect_whatsapp_cloud', wa)} className={ADMIN_PRIMARY_BUTTON}>
                  {isBusy === 'wa' && <Loader2 className="h-4 w-4 animate-spin" />}{t.waConnect}
                </button>
              </div>
            ) : !status.qrGatewayAvailable ? (
              <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">{t.waOwnUnavailable}</p>
            ) : (
              <div className="space-y-3">
                {overview.whatsappQr && (
                  <div className="space-y-2 text-center">
                    <p className="text-sm text-stone-600">{t.waScan}</p>
                    <img src={overview.whatsappQr} alt="WhatsApp QR" className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
                  </div>
                )}
                <button type="button" disabled={isBusy !== null} onClick={() => act('wa', 'connect_whatsapp_qr')} className={ADMIN_PRIMARY_BUTTON}>
                  {isBusy === 'wa' && <Loader2 className="h-4 w-4 animate-spin" />}{t.waConnect}
                </button>
              </div>
            )}
          </>
        )}
        <ModePicker mode={settings.whatsapp_mode} t={t} onChange={(mode) => save({ whatsapp_mode: mode })} />
      </Card>
    </div>
  );
}
