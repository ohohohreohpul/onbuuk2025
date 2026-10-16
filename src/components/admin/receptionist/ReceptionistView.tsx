import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SEGMENTED_CONTROL, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE, ADMIN_SURFACE } from '../adminUi';
import { loadOverview, updateSettings, type Overview } from './receptionistApi';
import { RECEPTIONIST_TEXT } from './receptionistText';
import { Switch } from './ChannelsPanel';
import InboxPanel from './InboxPanel';
import ChannelsPanel from './ChannelsPanel';
import KnowledgePanel from './KnowledgePanel';
import OutreachPanel from './OutreachPanel';
import PlaybookPanel from './PlaybookPanel';
import { PLAYBOOK_TEXT } from './playbookText';

type Tab = 'inbox' | 'channels' | 'knowledge' | 'playbook' | 'outreach';

/** AI receptionist: one switch, then inbox / channels / knowledge / WhatsApp outreach. */
export default function ReceptionistView({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { t } = useAdminText(RECEPTIONIST_TEXT);
  const { t: playbookText } = useAdminText(PLAYBOOK_TEXT);
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
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'inbox', label: t.tabInbox, badge: status.needsHuman + status.drafts },
    { id: 'channels', label: t.tabChannels },
    { id: 'knowledge', label: t.tabKnowledge },
    { id: 'playbook', label: playbookText.tab },
    { id: 'outreach', label: t.tabOutreach },
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
    <div className="space-y-6">
      <header className="flex flex-col gap-4 pl-12 sm:flex-row sm:items-start sm:justify-between lg:pl-0">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#1A1714]"><Bot className="h-6 w-6" />{t.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-500">{t.intro}</p>
          <p className="mt-1 text-xs text-stone-400">{fillText(t.usage, { tokens: status.tokensThisMonth.toLocaleString() })}</p>
        </div>
        <div className={`${ADMIN_SURFACE} flex items-center gap-3 px-4 py-3`}>
          <span className="text-sm font-medium text-[#1A1714]">{settings.is_enabled ? t.masterOn : t.masterOff}</span>
          <Switch isOn={settings.is_enabled} label={t.title} onChange={toggleMaster} />
        </div>
      </header>

      {!status.aiConfigured && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t.aiMissing}</p>
      )}
      {saveError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>}

      <div className={`${ADMIN_SEGMENTED_CONTROL} max-w-full overflow-x-auto`} role="tablist">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${tab === item.id ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE}`}>
            {item.label}
            {item.badge ? <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'inbox' && <InboxPanel overview={overview} onChanged={load} />}
      {tab === 'channels' && <ChannelsPanel overview={overview} onOverview={setOverview} />}
      {tab === 'knowledge' && <KnowledgePanel overview={overview} onOverview={setOverview} onNavigate={onNavigate} />}
      {tab === 'playbook' && <PlaybookPanel overview={overview} onOverview={setOverview} />}
      {tab === 'outreach' && <OutreachPanel overview={overview} />}
    </div>
  );
}
