import { useCallback, useEffect, useState } from 'react';
import { Facebook, Instagram, KeyRound, Loader2, MapPin, MessageCircle, Plus, Sparkles } from 'lucide-react';
import { adminAuth } from '../../../lib/adminAuth';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { hostUrl, shopUrl } from '../../../lib/tenantHost';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_STATUS_PILL, ADMIN_SURFACE, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { SOCIAL_TEXT } from './socialText';
import {
  disconnectAccount, loadAutomations, loadStatus, PlanRequiredError, startConnect, syncAccounts,
  type Automation, type ConnectPlatform, type SocialAccount,
} from './socialApi';
import AutomationModal from './AutomationModal';
import LocalSeoSection from './LocalSeoSection';
import OwnZernioModal from './OwnZernioModal';
import { OWN_ZERNIO_TEXT } from './ownZernioText';

const NEW_AUTOMATION = 'new';
const PLATFORM_ICON = { instagram: Instagram, facebook: Facebook, googlebusiness: MapPin } as const;
const PLATFORM_NAME = { instagram: 'Instagram', facebook: 'Facebook', googlebusiness: 'Google' } as const;

/** Reads ?connected=… once after the Instagram/Facebook consent page, then cleans the address. */
function consumeConnectedFlag(): boolean {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('connected')) return false;
  url.searchParams.delete('connected');
  window.history.replaceState(window.history.state, '', url);
  return true;
}

interface SocialViewProps {
  onNavigate?: (view: string) => void;
}

/** Zenno Social: connect Instagram/Facebook, DMs go to the AI inbox, comment-to-DM automations. */
export default function SocialView({ onNavigate }: SocialViewProps) {
  const { subdomain, customDomain } = useTenant();
  const { t } = useAdminText(SOCIAL_TEXT);
  const [hasSocial, setHasSocial] = useState<boolean | null>(null);
  const [hasLocalSeo, setHasLocalSeo] = useState(false);
  const [ownZernio, setOwnZernio] = useState(false);
  const [isZernioOpen, setIsZernioOpen] = useState(false);
  const { t: z } = useAdminText(OWN_ZERNIO_TEXT);
  const isOwner = adminAuth.getCurrentUser()?.role === 'owner';
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const bookingUrl = customDomain ? hostUrl(customDomain) : subdomain ? shopUrl(subdomain) : '';
  // Comment-to-DM runs on Instagram/Facebook only; Google has its own section.
  const activeAccounts = accounts.filter((a) => a.isActive && a.platform !== 'googlebusiness');
  const hasGoogle = accounts.some((a) => a.isActive && a.platform === 'googlebusiness');

  const load = useCallback(async () => {
    try {
      const isReturning = consumeConnectedFlag();
      const status = await loadStatus();
      setHasSocial(status.hasSocial);
      setHasLocalSeo(status.hasLocalSeo === true);
      setOwnZernio(status.ownZernio === true);
      if (!status.hasSocial) return;
      // Coming back from the consent page: pull the new account from Zernio first.
      const synced = isReturning ? (await syncAccounts()).accounts : status.accounts;
      setAccounts(synced);
      if (isReturning) setNotice({ tone: 'ok', text: t.connectedNotice });
      setAutomations((await loadAutomations()).automations);
    } catch (error) {
      if (error instanceof PlanRequiredError) {
        setHasSocial(false);
        return;
      }
      console.error('Could not load social:', error);
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.loadFailed });
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const connect = async (platform: ConnectPlatform) => {
    setBusy(platform);
    setNotice(null);
    try {
      await startConnect(platform);
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.loadFailed });
      setBusy(null);
    }
  };

  const disconnect = async (account: SocialAccount) => {
    if (!confirm(t.confirmDisconnect)) return;
    setBusy(account.id);
    try {
      setAccounts((await disconnectAccount(account.id)).accounts);
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.loadFailed });
    } finally {
      setBusy(null);
    }
  };

  if (hasSocial === null && !notice) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;
  }

  const header = (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">{t.title}</h1>
      <p className="mt-1 max-w-xl text-sm text-stone-500">{t.subtitle}</p>
    </header>
  );

  if (hasSocial === false) {
    return (
      <div className="space-y-6">
        {header}
        <section className={`${ADMIN_SURFACE} flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center`}>
          <Sparkles className="h-7 w-7 shrink-0 text-stone-400" strokeWidth={1.5} />
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold text-[#1A1714]">{t.planTitle}</h2>
            <p className="mt-1 text-sm text-stone-500">{t.planBody}</p>
          </div>
          <button type="button" onClick={() => onNavigate?.('settings')} className={ADMIN_PRIMARY_BUTTON}>{t.planButton}</button>
        </section>
      </div>
    );
  }

  const openAutomation = openId === NEW_AUTOMATION ? null : automations.find((a) => a.id === openId) ?? null;
  const accountName = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    return account ? `${PLATFORM_NAME[account.platform]} · ${account.username ?? account.displayName ?? ''}` : '';
  };

  return (
    <div className="space-y-6">
      {header}
      {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p>}

      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">{t.accounts}</h2>
            <p className="mt-0.5 text-sm text-stone-500">{t.accountsHint}</p>
          </div>
          <span className="flex flex-wrap gap-2">
            {isOwner && (
              <button type="button" onClick={() => setIsZernioOpen(true)} className={ADMIN_TERTIARY_BUTTON}>
                <KeyRound className="h-4 w-4" /> {z.button}{ownZernio ? ' ✓' : ''}
              </button>
            )}
            {(['instagram', 'facebook'] as const).map((platform) => {
              const Icon = PLATFORM_ICON[platform];
              return (
                <button key={platform} type="button" disabled={busy !== null} onClick={() => connect(platform)} className={ADMIN_SECONDARY_BUTTON}>
                  {busy === platform ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  {busy === platform ? t.connecting : platform === 'instagram' ? t.connectInstagram : t.connectFacebook}
                </button>
              );
            })}
          </span>
        </div>
        <ul className={`${ADMIN_SURFACE} divide-y divide-stone-200/70`}>
          {accounts.length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-500">{t.noAccounts}</li>}
          {accounts.map((account) => {
            const Icon = PLATFORM_ICON[account.platform];
            return (
              <li key={account.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="flex min-w-0 items-center gap-3">
                  {account.pictureUrl
                    ? <img src={account.pictureUrl} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 rounded-full object-cover" />
                    : <Icon className="h-5 w-5 text-stone-400" strokeWidth={1.5} />}
                  <span className="truncate text-sm font-medium text-[#1A1714]">{account.username ?? account.displayName}</span>
                  <span className={`${ADMIN_STATUS_PILL} ${account.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{account.isActive ? t.connected : t.inactive}</span>
                </span>
                {account.isActive && (
                  <button type="button" disabled={busy !== null} onClick={() => disconnect(account)} className={ADMIN_TERTIARY_BUTTON}>{t.disconnect}</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={`${ADMIN_SURFACE} flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center`}>
        <MessageCircle className="h-6 w-6 shrink-0 text-stone-400" strokeWidth={1.5} />
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold text-[#1A1714]">{t.dmTitle}</h2>
          <p className="mt-1 text-sm text-stone-500">{t.dmBody}</p>
        </div>
        <button type="button" onClick={() => onNavigate?.('receptionist')} className={ADMIN_SECONDARY_BUTTON}>{t.openInbox}</button>
      </section>

      {hasLocalSeo && (
        <LocalSeoSection isConnected={hasGoogle} isConnecting={busy === 'googlebusiness'} bookingUrl={bookingUrl} onConnect={() => connect('googlebusiness')} />
      )}

      <section className="space-y-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">{t.automations}</h2>
            <p className="mt-0.5 max-w-xl text-sm text-stone-500">{t.automationsHint}</p>
          </div>
          <button
            type="button"
            onClick={() => (activeAccounts.length ? setOpenId(NEW_AUTOMATION) : setNotice({ tone: 'error', text: t.needAccount }))}
            className={ADMIN_PRIMARY_BUTTON}
          >
            <Plus className="h-4 w-4" /> {t.newAutomation}
          </button>
        </div>
        <ul className={`${ADMIN_SURFACE} divide-y divide-stone-200/70`}>
          {automations.length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-500">{t.noAutomations}</li>}
          {automations.map((automation) => (
            <li key={automation.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-[#1A1714]">{automation.name}</span>
                  <span className={`${ADMIN_STATUS_PILL} ${automation.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{automation.isActive ? t.on : t.off}</span>
                </span>
                <span className="mt-1 block truncate text-sm text-stone-500">
                  {automation.keywords.map((k) => `„${k}“`).join(', ')} · {accountName(automation.accountId)}
                  {automation.sent !== null && ` · ${fillText(t.sentCount, { count: automation.sent })}`}
                </span>
              </span>
              <button type="button" onClick={() => setOpenId(automation.id)} className={`${ADMIN_SECONDARY_BUTTON} shrink-0`}>{t.edit}</button>
            </li>
          ))}
        </ul>
      </section>

      {isZernioOpen && (
        <OwnZernioModal
          ownZernio={ownZernio}
          hasActiveAccounts={accounts.some((a) => a.isActive)}
          onClose={() => setIsZernioOpen(false)}
          onChanged={(isOwn, next) => { setOwnZernio(isOwn); setAccounts(next); }}
        />
      )}

      {openId && (
        <AutomationModal
          automation={openAutomation}
          accounts={activeAccounts}
          bookingUrl={bookingUrl}
          canEdit
          onClose={() => setOpenId(null)}
          onSaved={() => { setOpenId(null); load(); }}
        />
      )}
    </div>
  );
}
