import { useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { adminAuth } from '../../../lib/adminAuth';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import {
  ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT, ADMIN_SURFACE, ADMIN_TERTIARY_BUTTON,
} from '../adminUi';
import { MARKETING_TEXT } from './marketingText';
import {
  AudienceCounts, Campaign, CampaignDraft, EMPTY_DRAFT, deleteCampaign, saveCampaign, sendNow, sendTest,
} from './marketingApi';

const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);
const HOURS = Array.from({ length: 16 }, (_, index) => index + 6);

interface CampaignEditorProps {
  businessId: string;
  campaign: Campaign | null;
  counts: AudienceCounts;
  onSaved: (campaign: Campaign) => void;
  onDeleted: () => void;
  onQueued: () => void;
}

const toDraft = (campaign: Campaign | null): CampaignDraft => (campaign ? {
  subject: campaign.subject, body: campaign.body, button_text: campaign.button_text, button_url: campaign.button_url,
  audience: campaign.audience, day_of_month: campaign.day_of_month, send_hour: campaign.send_hour, is_active: campaign.is_active,
} : EMPTY_DRAFT);

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export default function CampaignEditor({ businessId, campaign, counts, onSaved, onDeleted, onQueued }: CampaignEditorProps) {
  const { t, locale } = useAdminText(MARKETING_TEXT);
  const [draft, setDraft] = useState<CampaignDraft>(() => toDraft(campaign));
  const [testEmail, setTestEmail] = useState(() => adminAuth.getCurrentUser()?.email ?? '');
  const [busy, setBusy] = useState<'save' | 'test' | 'send' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const recipients = draft.audience === 'all' ? counts.all : counts.subscribers;
  const update = (patch: Partial<CampaignDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const validate = (): string | null => {
    if (!draft.subject.trim() || !draft.body.trim()) return t.required;
    if (draft.button_url && !draft.button_url.startsWith('https://')) return t.httpsOnly;
    return null;
  };

  const save = async (): Promise<Campaign | null> => {
    const invalid = validate();
    if (invalid) { setNotice({ tone: 'error', text: invalid }); return null; }
    setBusy('save');
    try {
      const saved = await saveCampaign(businessId, campaign?.id ?? null, draft);
      onSaved(saved);
      setNotice({ tone: 'ok', text: t.saved });
      return saved;
    } catch (error) {
      console.error('Could not save campaign:', error);
      setNotice({ tone: 'error', text: fillText(t.saveFailed, { reason: reasonOf(error) }) });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    const saved = await save();
    if (!saved) return;
    setBusy('test');
    try {
      await sendTest(saved.id, testEmail.trim());
      setNotice({ tone: 'ok', text: fillText(t.testSent, { email: testEmail.trim() }) });
    } catch (error) {
      console.error('Test email failed:', error);
      setNotice({ tone: 'error', text: fillText(t.testFailed, { reason: reasonOf(error) }) });
    } finally {
      setBusy(null);
    }
  };

  const runNow = async () => {
    if (!confirm(fillText(t.confirmSendNow, { count: recipients }))) return;
    const saved = await save();
    if (!saved) return;
    setBusy('send');
    try {
      const queued = await sendNow(saved.id);
      setNotice({ tone: 'ok', text: fillText(t.queued, { count: queued }) });
      onQueued();
    } catch (error) {
      console.error('Could not queue campaign:', error);
      setNotice({ tone: 'error', text: fillText(t.sendFailed, { reason: reasonOf(error) }) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!campaign || !confirm(t.confirmDelete)) return;
    try {
      await deleteCampaign(campaign.id);
      onDeleted();
    } catch (error) {
      setNotice({ tone: 'error', text: fillText(t.saveFailed, { reason: reasonOf(error) }) });
    }
  };

  const nextSend = campaign?.is_active && campaign.next_send_at
    ? new Date(campaign.next_send_at).toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Berlin' })
    : null;

  return (
    <div className="space-y-5">
      <section className={`${ADMIN_SURFACE} space-y-4 p-6`}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t.subject}</span>
          <input value={draft.subject} onChange={(e) => update({ subject: e.target.value })} maxLength={200} placeholder={t.subjectPlaceholder} className={ADMIN_INPUT} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t.body}</span>
          <textarea value={draft.body} onChange={(e) => update({ body: e.target.value })} rows={11} maxLength={10000} placeholder={t.bodyPlaceholder} className={`${ADMIN_INPUT} leading-relaxed`} />
          <span className="mt-1.5 block text-xs text-stone-500">{t.bodyHint}</span>
        </label>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-stone-700">{t.buttonOptional}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={draft.button_text ?? ''} onChange={(e) => update({ button_text: e.target.value })} maxLength={60} placeholder={t.buttonText} aria-label={t.buttonText} className={ADMIN_INPUT} />
            <input value={draft.button_url ?? ''} onChange={(e) => update({ button_url: e.target.value.trim() })} placeholder={t.buttonUrl} aria-label={t.buttonUrl} inputMode="url" className={ADMIN_INPUT} />
          </div>
        </fieldset>
      </section>

      <section className={`${ADMIN_SURFACE} grid gap-6 p-6 md:grid-cols-2`}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">{t.audience}</legend>
          {([['subscribers', t.audienceSubscribers, t.audienceSubscribersHint, counts.subscribers], ['all', t.audienceAll, t.audienceAllHint, counts.all]] as const).map(([value, label, hint, count]) => (
            <label key={value} className={`mb-2 flex cursor-pointer gap-3 rounded-xl p-3 ring-1 transition ${draft.audience === value ? 'bg-white ring-stone-900/30' : 'ring-stone-200/80 hover:bg-white/70'}`}>
              <input type="radio" name="audience" checked={draft.audience === value} onChange={() => update({ audience: value })} className="mt-1 accent-[#1A1714]" />
              <span>
                <span className="block text-sm font-medium text-[#1A1714]">{label} · {fillText(t.reach, { count })}</span>
                <span className="block text-xs text-stone-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium text-stone-700">{t.schedule}</legend>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="mb-1 block text-xs text-stone-500">{t.dayOfMonth}</span>
              <select value={draft.day_of_month} onChange={(e) => update({ day_of_month: Number(e.target.value) })} className={ADMIN_SELECT}>
                {DAYS.map((day) => <option key={day} value={day}>{day}.</option>)}
              </select>
            </label>
            <label><span className="mb-1 block text-xs text-stone-500">{t.hour}</span>
              <select value={draft.send_hour} onChange={(e) => update({ send_hour: Number(e.target.value) })} className={ADMIN_SELECT}>
                {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
              </select>
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => update({ is_active: e.target.checked })} className="h-4 w-4 accent-[#1A1714]" />
            <span className="text-sm font-medium text-[#1A1714]">{t.monthlyOn}</span>
          </label>
          <p className="text-xs text-stone-500">{t.monthlyHint}</p>
          {nextSend && <p className="text-xs font-medium text-emerald-700">{fillText(t.nextSend, { date: nextSend })}</p>}
        </fieldset>
      </section>

      <section className={`${ADMIN_SURFACE} flex flex-col gap-3 p-6 sm:flex-row sm:items-end`}>
        <label className="flex-1">
          <span className="mb-1.5 block text-sm font-medium text-stone-700">{t.testTitle}</span>
          <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className={ADMIN_INPUT} />
        </label>
        <button type="button" onClick={runTest} disabled={busy !== null || !testEmail.trim()} className={ADMIN_SECONDARY_BUTTON}>
          {busy === 'test' ? t.testSending : t.testSend}
        </button>
      </section>

      {notice && (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {campaign ? (
          <button type="button" onClick={remove} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50`}><Trash2 className="h-4 w-4" /> {t.delete}</button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={runNow} disabled={busy !== null || recipients === 0} className={ADMIN_SECONDARY_BUTTON}>
            <Send className="h-4 w-4" /> {t.sendNow}
          </button>
          <button type="button" onClick={save} disabled={busy !== null} className={ADMIN_PRIMARY_BUTTON}>{busy === 'save' ? t.saving : t.save}</button>
        </div>
      </div>
      <p className="text-xs text-stone-500">{t.legalNote}</p>
    </div>
  );
}
