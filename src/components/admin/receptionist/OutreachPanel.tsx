import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Upload, Users } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { readCsvTable } from '../../../lib/dataImport/csvTable';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_STATUS_PILL, ADMIN_SURFACE } from '../adminUi';
import CalendarModal from '../calendar/CalendarModal';
import { Switch } from './ChannelsPanel';
import { consentRowsFromCsv } from './consentCsv';
import { callReceptionist, countConsents, loadCampaigns, type Campaign, type Overview } from './receptionistApi';
import { RECEPTIONIST_TEXT, type ReceptionistText } from './receptionistText';

type CampaignRow = Campaign & { sent: number; failed: number };

function statusOf(c: CampaignRow, t: ReceptionistText): { label: string; tone: string } {
  if (c.status === 'sending') return { label: t.statusSending, tone: 'bg-sky-100 text-sky-900' };
  if (c.status === 'paused') return { label: t.statusPaused, tone: 'bg-amber-100 text-amber-900' };
  if (c.status === 'done') return { label: t.statusDone, tone: 'bg-emerald-50 text-emerald-800' };
  return { label: t.statusDraft, tone: 'bg-stone-100 text-stone-700' };
}

function CampaignModal({ campaign, isOfficial, audience, t, onClose, onChanged }: {
  campaign: CampaignRow | null; isOfficial: boolean; audience: number; t: ReceptionistText; onClose: () => void; onChanged: () => void;
}) {
  const [form, setForm] = useState({
    name: campaign?.name ?? '', message: campaign?.message ?? '', isPersonalised: campaign?.is_personalised ?? false,
    templateName: campaign?.template_name ?? '', templateLanguage: campaign?.template_language ?? 'de',
  });
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDraft = !campaign || campaign.status === 'draft';

  const run = async (action: string, payload: Record<string, unknown>) => {
    setIsBusy(true);
    setError(null);
    try {
      const result = await callReceptionist<{ campaign?: Campaign }>(action, payload);
      onChanged();
      return result;
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : t.saveFailed);
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const saveDraft = () => run('save_campaign', { campaignId: campaign?.id, ...form });
  const start = async () => {
    const saved = await saveDraft();
    const id = saved?.campaign?.id ?? campaign?.id;
    if (id && await run('start_campaign', { campaignId: id })) onClose();
  };

  return (
    <CalendarModal title={campaign?.name || t.newMessage} closeLabel={t.close} onClose={onClose} maxWidthClass="max-w-xl">
      <div className="space-y-4">
        <label className="block text-sm text-stone-600">{t.campaignName}
          <input value={form.name} disabled={!isDraft} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} className={`${ADMIN_INPUT} mt-1`} />
        </label>
        <label className="block text-sm text-stone-600">{t.campaignMessage}
          <textarea value={form.message} disabled={!isDraft} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} maxLength={1500} className={`${ADMIN_INPUT} mt-1`} />
          <span className="mt-1 block text-xs text-stone-400">{t.campaignMessageHint}</span>
        </label>
        {isOfficial ? (
          <div className="space-y-2 rounded-2xl bg-stone-900/[0.04] p-4">
            <p className="text-xs text-stone-500">{t.templateHint}</p>
            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
              <input value={form.templateName} disabled={!isDraft} onChange={(e) => setForm({ ...form, templateName: e.target.value })} placeholder={t.templateName} className={ADMIN_INPUT} />
              <input value={form.templateLanguage} disabled={!isDraft} onChange={(e) => setForm({ ...form, templateLanguage: e.target.value })} placeholder={t.templateLanguage} className={ADMIN_INPUT} />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <span><span className="block text-sm font-medium text-[#1A1714]">{t.personalise}</span><span className="text-xs text-stone-500">{t.personaliseHint}</span></span>
            <Switch isOn={form.isPersonalised} label={t.personalise} isDisabled={!isDraft} onChange={(on) => setForm({ ...form, isPersonalised: on })} />
          </div>
        )}
        {campaign && !isDraft && <p className="text-sm text-stone-600">{fillText(t.campaignStats, { sent: campaign.sent, total: campaign.recipient_count })}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {isDraft && <button type="button" disabled={isBusy} onClick={saveDraft} className={ADMIN_SECONDARY_BUTTON}>{t.saveDraft}</button>}
          {isDraft && !isConfirming && (
            <button type="button" disabled={isBusy || audience === 0 || !form.name || !form.message} onClick={() => setIsConfirming(true)} className={ADMIN_PRIMARY_BUTTON}>
              {fillText(t.startSending, { count: audience })}
            </button>
          )}
          {isDraft && isConfirming && (
            <button type="button" disabled={isBusy} onClick={start} className={`${ADMIN_PRIMARY_BUTTON} bg-emerald-700 hover:bg-emerald-800`}>
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}{fillText(t.startConfirm, { count: audience })}
            </button>
          )}
          {campaign?.status === 'sending' && <button type="button" disabled={isBusy} onClick={() => run('pause_campaign', { campaignId: campaign.id })} className={ADMIN_SECONDARY_BUTTON}>{t.pause}</button>}
          {campaign?.status === 'paused' && <button type="button" disabled={isBusy} onClick={() => run('resume_campaign', { campaignId: campaign.id })} className={ADMIN_PRIMARY_BUTTON}>{t.resume}</button>}
        </div>
      </div>
    </CalendarModal>
  );
}

export default function OutreachPanel({ overview }: { overview: Overview }) {
  const { t, locale } = useAdminText(RECEPTIONIST_TEXT);
  const businessId = overview.settings.business_id;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [consents, setConsents] = useState(0);
  const [evidence, setEvidence] = useState('');
  const [importState, setImportState] = useState<{ busy: boolean; message: string | null; isError: boolean }>({ busy: false, message: null, isError: false });
  const [openId, setOpenId] = useState<string | 'new' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [rows, count] = await Promise.all([loadCampaigns(businessId), countConsents(businessId)]);
      setCampaigns(rows);
      setConsents(count);
    } catch (error) {
      console.error('Could not load outreach:', error);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const importFile = async (file: File) => {
    setImportState({ busy: true, message: null, isError: false });
    try {
      const rows = consentRowsFromCsv(readCsvTable(await file.text()));
      const result = await callReceptionist<{ imported: number; consented: number; skipped: string[] }>('import_consents', { rows, evidence });
      const summary = fillText(t.importResult, { imported: result.imported, consented: result.consented });
      setImportState({ busy: false, message: [summary, ...result.skipped.slice(0, 5)].join('\n'), isError: false });
      load();
    } catch (error) {
      setImportState({ busy: false, message: error instanceof Error ? error.message : t.saveFailed, isError: true });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const opened = openId && openId !== 'new' ? campaigns.find((c) => c.id === openId) ?? null : null;

  return (
    <div className="space-y-5">
      <section className={`${ADMIN_SURFACE} space-y-4 p-6`}>
        <header>
          <h2 className="font-semibold text-[#1A1714]">{t.outreachTitle}</h2>
          <p className="text-sm text-stone-500">{t.outreachHint}</p>
        </header>
        <p className="flex items-center gap-2 text-sm font-medium text-[#1A1714]"><Users className="h-4 w-4" />{fillText(t.consented, { count: consents })}</p>
        <div className="space-y-2 rounded-2xl bg-stone-900/[0.04] p-4">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.importTitle}</h3>
          <p className="text-xs text-stone-500">{t.importHint}</p>
          <input value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={500} placeholder={t.evidencePlaceholder} aria-label={t.evidence} className={ADMIN_INPUT} />
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button type="button" disabled={importState.busy} onClick={() => fileRef.current?.click()} className={ADMIN_SECONDARY_BUTTON}>
            {importState.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{importState.busy ? t.importing : t.importButton}
          </button>
          {importState.message && <p className={`whitespace-pre-line text-sm ${importState.isError ? 'text-red-700' : 'text-emerald-800'}`}>{importState.message}</p>}
        </div>
      </section>

      <section className={`${ADMIN_SURFACE} divide-y divide-stone-100 overflow-hidden`}>
        <div className="flex items-center justify-between p-5">
          <h3 className="font-semibold text-[#1A1714]">{t.tabOutreach}</h3>
          <button type="button" onClick={() => setOpenId('new')} className={ADMIN_PRIMARY_BUTTON}><Plus className="h-4 w-4" />{t.newMessage}</button>
        </div>
        {campaigns.length === 0 && <p className="p-8 text-center text-sm text-stone-500">{t.noCampaigns}</p>}
        {campaigns.map((c) => {
          const state = statusOf(c, t);
          return (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#1A1714]">{c.name}</p>
                <p className="text-sm text-stone-500">
                  {new Date(c.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                  {c.status !== 'draft' && ` · ${fillText(t.campaignStats, { sent: c.sent, total: c.recipient_count })}`}
                </p>
              </div>
              <span className={`${ADMIN_STATUS_PILL} ${state.tone}`}>{state.label}</span>
              <button type="button" onClick={() => setOpenId(c.id)} className={ADMIN_SECONDARY_BUTTON}>{t.open}</button>
            </div>
          );
        })}
      </section>

      {openId && (
        <CampaignModal
          campaign={opened}
          isOfficial={overview.settings.whatsapp_provider === 'cloud_api'}
          audience={consents}
          t={t}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
