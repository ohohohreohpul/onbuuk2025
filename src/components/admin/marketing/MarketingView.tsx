import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Copy, Mail, Plus } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_STATUS_PILL, ADMIN_SURFACE, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { MARKETING_TEXT } from './marketingText';
import { AudienceCounts, Campaign, CampaignDraft, EMPTY_COUNTS, duplicateCampaign, loadAudienceCounts, loadCampaigns, loadGoogleReviewUrl } from './marketingApi';
import { AUTOMATION_TEXT } from './automationText';
import AutomationsSection from './AutomationsSection';
import CampaignEditor from './CampaignEditor';
import CampaignHistory from './CampaignHistory';

const NEW_ID = 'new';

/** List of promotions first; one opens in the editor, "back" returns to the list. */
export default function MarketingView() {
  const { businessId } = useTenant();
  const { t, locale } = useAdminText(MARKETING_TEXT);
  const { t: a } = useAdminText(AUTOMATION_TEXT);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [counts, setCounts] = useState<AudienceCounts>(EMPTY_COUNTS);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<CampaignDraft | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  // Changes only when a promotion is opened, so saving a new one (which gives it an id) keeps the editor.
  const [editorKey, setEditorKey] = useState(0);
  const open = (id: string | null, draft?: CampaignDraft) => { setNewDraft(draft); setOpenId(id); setEditorKey((key) => key + 1); };
  const promotions = campaigns.filter((c) => (c.kind ?? 'monthly') === 'monthly');

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      const [list, audience, googleReviewUrl] = await Promise.all([loadCampaigns(businessId), loadAudienceCounts(),
        // Optional (local SEO): the review request row simply stays hidden if this fails.
        loadGoogleReviewUrl(businessId).catch(() => null)]);
      setCampaigns(list);
      setCounts(audience);
      setReviewUrl(googleReviewUrl);
      setError(false);
    } catch (loadError) {
      console.error('Could not load email marketing:', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' });

  const duplicate = async (campaign: Campaign) => {
    if (!businessId) return;
    setBusyId(campaign.id);
    try {
      const copy = await duplicateCampaign(businessId, campaign, t.copyPrefix);
      setCampaigns((current) => [...current, copy]);
      open(copy.id);
    } catch (copyError) {
      console.error('Could not duplicate campaign:', copyError);
      setError(true);
    } finally {
      setBusyId(null);
    }
  };

  if (!businessId) return null;

  if (openId) {
    const campaign = openId === NEW_ID ? null : campaigns.find((c) => c.id === openId) ?? null;
    return (
      <div className="space-y-5">
        <button type="button" onClick={() => { open(null); load(); }} className={ADMIN_TERTIARY_BUTTON}>
          <ArrowLeft className="h-4 w-4" /> {t.back}
        </button>
        <CampaignEditor
          key={editorKey}
          businessId={businessId}
          campaign={campaign}
          initialDraft={newDraft}
          counts={counts}
          onSaved={(saved) => {
            setCampaigns((current) => current.some((c) => c.id === saved.id) ? current.map((c) => (c.id === saved.id ? saved : c)) : [...current, saved]);
            setOpenId(saved.id);
          }}
          onDeleted={() => { setCampaigns((current) => current.filter((c) => c.id !== openId)); open(null); }}
          onQueued={() => setHistoryKey((key) => key + 1)}
        />
        {campaign && <CampaignHistory campaignId={campaign.id} refreshKey={historyKey} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">{t.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-500">{t.subtitle}</p>
        </div>
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

      <AutomationsSection campaigns={campaigns} counts={counts} loading={loading} reviewUrl={reviewUrl} onOpen={(id) => open(id)} onCreate={(draft) => open(NEW_ID, draft)} />

      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">{a.promotionsTitle}</h2>
        <button type="button" onClick={() => open(NEW_ID)} className={ADMIN_PRIMARY_BUTTON}><Plus className="h-4 w-4" /> {t.newCampaign}</button>
      </div>

      {!loading && promotions.length === 0 ? (
        <div className={`${ADMIN_SURFACE} px-6 py-14 text-center`}>
          <Mail className="mx-auto h-7 w-7 text-stone-400" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-stone-700">{t.noCampaigns}</p>
          <p className="mt-1 text-xs text-stone-500">{t.noCampaignsHint}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {promotions.map((campaign) => (
            <li key={campaign.id} className={`${ADMIN_SURFACE} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
              <button type="button" onClick={() => open(campaign.id)} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-[#1A1714]">{campaign.subject || t.noSubject}</span>
                  <span className={`${ADMIN_STATUS_PILL} ${campaign.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{campaign.is_active ? t.active : t.paused}</span>
                </span>
                <span className="mt-1 block text-sm text-stone-500">
                  {campaign.is_active && campaign.next_send_at
                    ? `${fillText(t.schedule_line, { day: campaign.day_of_month, hour: String(campaign.send_hour).padStart(2, '0') })} · ${fillText(t.nextShort, { date: formatDate(campaign.next_send_at) })}`
                    : campaign.last_queued_at ? fillText(t.lastSent, { date: formatDate(campaign.last_queued_at) }) : t.neverSent}
                </span>
              </button>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => duplicate(campaign)} disabled={busyId === campaign.id} className={ADMIN_TERTIARY_BUTTON}><Copy className="h-4 w-4" /> {t.duplicate}</button>
                <button type="button" onClick={() => open(campaign.id)} className={ADMIN_SECONDARY_BUTTON}>{t.open}</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
