import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Bot, Inbox, Megaphone, Radio, Smile, type LucideIcon } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { loadOverview, updateSettings, type Overview } from './receptionistApi';
import { RECEPTIONIST_TEXT } from './receptionistText';
import { Switch } from './ChannelsPanel';
import InboxPanel from './InboxPanel';
import ChannelsPanel from './ChannelsPanel';
import KnowledgePanel from './KnowledgePanel';
import OutreachPanel from './OutreachPanel';
import BriefingPanel from './BriefingPanel';
import { BRIEFING_TEXT } from './briefingText';

type Tab = 'inbox' | 'channels' | 'knowledge' | 'personality' | 'outreach';

/** AI receptionist: one switch, then inbox / channels / knowledge / WhatsApp outreach. */
export default function ReceptionistView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { t } = useAdminText(RECEPTIONIST_TEXT);
  const { t: briefingText } = useAdminText(BRIEFING_TEXT);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [hasError, setHasError] = useState(false);
  const [tab, setTab] = useState<Tab>('inbox');
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await loadOverview());
      setHasError(false);
    } catch (error) {
      console.error('Could not load the receptionist:', error);
      setHasError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (hasError) {
    return (
      <div className={`${ADMIN_SURFACE} flex flex-col items-center gap-3 p-10 text-center`}>
        <p className="text-sm text-stone-600">{t.loadFailed}</p>
        <button type="button" onClick={load} className={ADMIN_SECONDARY_BUTTON}>{t.retry}</button>
      </div>
    );
  }
  if (!overview) {
    return <div className="flex justify-center p-16"><div className="h-9 w-9 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" /></div>;
  }

  const { settings, status } = overview;
  const tabs: { id: Tab; label: string; icon: LucideIcon; badge?: number }[] = [
    { id: 'inbox', label: t.tabInbox, icon: Inbox, badge: status.needsHuman + status.drafts },
    { id: 'personality', label: briefingText.tab, icon: Smile },
    { id: 'knowledge', label: t.tabKnowledge, icon: BookOpen },
    { id: 'channels', label: t.tabChannels, icon: Radio },
    { id: 'outreach', label: t.tabOutreach, icon: Megaphone },
  ];

  const toggleMaster = async (isOn: boolean) => {
    setSaveError(null);
    try {
      setOverview(await updateSettings({ is_enabled: isOn }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.saveFailed);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 pl-12 lg:pl-0">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1A1714] text-white"><Bot className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-tight tracking-tight text-[#1A1714]">{t.title}</h1>
          <p className="truncate text-xs text-stone-500" title={t.intro}>{fillText(t.usage, { tokens: status.tokensThisMonth.toLocaleString() })}</p>
        </div>
        <label className={`flex cursor-pointer items-center gap-2.5 rounded-full border py-1.5 pl-3.5 pr-1.5 text-sm font-medium transition ${settings.is_enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-stone-200 bg-white/70 text-stone-600'}`}>
          <span className={`h-2 w-2 rounded-full ${settings.is_enabled ? 'animate-pulse bg-emerald-500' : 'bg-stone-400'}`} />
          {settings.is_enabled ? t.masterOn : t.masterOff}
          <Switch isOn={settings.is_enabled} label={t.title} onChange={toggleMaster} />
        </label>
      </header>

      {!status.aiConfigured && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t.aiMissing}</p>
      )}
      {saveError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>}

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-stone-200/80 px-1" role="tablist">
        {tabs.map((item) => {
          const isActive = tab === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={isActive} onClick={() => setTab(item.id)}
              className={`relative -mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${isActive ? 'border-[#1A1714] text-[#1A1714]' : 'border-transparent text-stone-500 hover:text-[#1A1714]'}`}>
              <Icon className="h-4 w-4" />
              {item.label}
              {item.badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-4 text-amber-950">{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>

      {tab === 'inbox' && <InboxPanel overview={overview} onChanged={load} />}
      {tab === 'channels' && <ChannelsPanel overview={overview} onOverview={setOverview} />}
      {tab === 'knowledge' && <KnowledgePanel overview={overview} onOverview={setOverview} onNavigate={onNavigate} />}
      {tab === 'personality' && <BriefingPanel overview={overview} onOverview={setOverview} />}
      {tab === 'outreach' && <OutreachPanel overview={overview} />}
    </div>
  );
}
