import { useCallback, useEffect, useState } from 'react';
import { Mail, Plus } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SURFACE, ADMIN_STATUS_PILL } from '../adminUi';
import { MARKETING_TEXT } from './marketingText';
import { AudienceCounts, Campaign, loadAudienceCounts, loadCampaigns } from './marketingApi';
import CampaignEditor from './CampaignEditor';
import CampaignHistory from './CampaignHistory';

const NEW_ID = 'new';

export default function MarketingView() {
  const { businessId } = useTenant();
  const { t } = useAdminText(MARKETING_TEXT);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [counts, setCounts] = useState<AudienceCounts>({ subscribers: 0, all: 0, unsubscribed: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  // Changes only when the owner picks another promotion, so saving does not reset the editor.
  const [editorKey, setEditorKey] = useState(0);
  const select = (id: string) => { setSelectedId(id); setEditorKey((key) => key + 1); };

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [list, audience] = await Promise.all([loadCampaigns(businessId), loadAudienceCounts()]);
      setCampaigns(list);
      setCounts(audience);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
      setError(false);
    } catch (loadError) {
      console.error('Could not load email marketing:', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const selected = campaigns.find((campaign) => campaign.id === selectedId) ?? null;
  const isEditing = selectedId !== null;

  const handleSaved = (saved: Campaign) => {
    setCampaigns((current) => current.some((c) => c.id === saved.id) ? current.map((c) => (c.id === saved.id ? saved : c)) : [...current, saved]);
    setSelectedId(saved.id);
  };

  const handleDeleted = () => {
    setCampaigns((current) => current.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  };

  if (!businessId) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">{t.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-500">{t.subtitle}</p>
        </div>
        <button type="button" onClick={() => select(NEW_ID)} className={ADMIN_PRIMARY_BUTTON}><Plus className="h-4 w-4" /> {t.newCampaign}</button>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t.loadFailed}</p>}

      <dl className="grid grid-cols-3 gap-3">
        {([[t.subscribers, counts.subscribers], [t.allCustomers, counts.all], [t.unsubscribed, counts.unsubscribed]] as const).map(([label, value]) => (
          <div key={label} className={`${ADMIN_SURFACE} p-4`}>
            <dt className="text-xs font-medium text-stone-500">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#1A1714]">{loading ? '–' : value}</dd>
          </div>
        ))}
      </dl>

      {campaigns.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {campaigns.map((campaign) => (
            <button key={campaign.id} type="button" onClick={() => select(campaign.id)}
              className={`max-w-xs truncate rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${campaign.id === selectedId ? 'bg-[#1A1714] text-white ring-transparent' : 'bg-white/70 text-stone-700 ring-stone-200/80 hover:bg-white'}`}>
              {campaign.subject}
              <span className={`${ADMIN_STATUS_PILL} ml-2 ${campaign.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{campaign.is_active ? t.active : t.paused}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && !isEditing && campaigns.length === 0 && (
        <div className={`${ADMIN_SURFACE} px-6 py-14 text-center`}>
          <Mail className="mx-auto h-7 w-7 text-stone-400" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-stone-700">{t.noCampaigns}</p>
          <p className="mt-1 text-xs text-stone-500">{t.noCampaignsHint}</p>
        </div>
      )}

      {isEditing && (
        <CampaignEditor
          key={editorKey}
          businessId={businessId}
          campaign={selectedId === NEW_ID ? null : selected}
          counts={counts}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onQueued={() => setHistoryKey((key) => key + 1)}
        />
      )}

      {selected && <CampaignHistory campaignId={selected.id} refreshKey={historyKey} />}
    </div>
  );
}
