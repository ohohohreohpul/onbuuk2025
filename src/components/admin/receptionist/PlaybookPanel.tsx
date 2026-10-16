import { useState } from 'react';
import { Loader2, MessageCircleHeart, Sparkles } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import CalendarModal from '../calendar/CalendarModal';
import { Switch } from './ChannelsPanel';
import { updateSettings, type Overview, type Playbook } from './receptionistApi';
import { PLAYBOOK_TEXT, SITUATIONS, type Situation } from './playbookText';
import { openWidgetPreview } from './widgetPreview';

const MAX_EXAMPLE_CHARS = 400;

interface PlaybookPanelProps {
  overview: Overview;
  onOverview: (overview: Overview) => void;
}

/** "How it talks": fixed situations, each switched on with a short example in the shop's own words. */
export default function PlaybookPanel({ overview, onOverview }: PlaybookPanelProps) {
  const { t } = useAdminText(PLAYBOOK_TEXT);
  const playbook: Playbook = overview.settings.playbook ?? {};
  const [editing, setEditing] = useState<Situation | null>(null);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestion = (s: Situation) => t[`${s}Example`];

  const save = async (next: Playbook) => {
    setIsSaving(true);
    setError(null);
    try {
      onOverview(await updateSettings({ playbook: next }));
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (s: Situation, isOn: boolean) => {
    const example = playbook[s]?.example?.trim() || suggestion(s);
    save({ ...playbook, [s]: { enabled: isOn, example } });
  };

  const openEditor = (s: Situation) => {
    setDraft(playbook[s]?.example || suggestion(s));
    setError(null);
    setEditing(s);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="max-w-2xl">
          <h2 className="font-semibold text-[#1A1714]">{t.title}</h2>
          <p className="text-sm text-stone-500">{t.hint}</p>
        </div>
        <button type="button" onClick={() => openWidgetPreview(overview.settings.widget_key)} disabled={!overview.settings.is_enabled}
          className={ADMIN_SECONDARY_BUTTON}><Sparkles className="h-4 w-4" />{t.tryIt}</button>
      </header>
      {error && !editing && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {SITUATIONS.map((s) => {
          const entry = playbook[s];
          const isOn = Boolean(entry?.enabled);
          return (
            <section key={s} className={`${ADMIN_SURFACE} flex flex-col gap-3 p-5 ${isOn ? '' : 'opacity-80'}`}>
              <header className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]"><MessageCircleHeart className="h-4 w-4" /></span>
                <h3 className="flex-1 font-semibold text-[#1A1714]">{t[`${s}Title`]}</h3>
                <Switch isOn={isOn} label={t[`${s}Title`]} isDisabled={isSaving} onChange={(on) => toggle(s, on)} />
              </header>
              <p className={`rounded-2xl rounded-bl-md px-4 py-3 text-sm ${isOn ? 'bg-[#F7F5F2] text-stone-800' : 'bg-stone-50 italic text-stone-400'}`}>
                {isOn ? entry?.example : (entry?.example || suggestion(s))}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400">{isOn ? '' : t.off}</span>
                <button type="button" onClick={() => openEditor(s)} className={`${ADMIN_SECONDARY_BUTTON} py-1.5`}>{t.edit}</button>
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <CalendarModal title={t[`${editing}Title`]} closeLabel={t.close} onClose={() => setEditing(null)} maxWidthClass="max-w-lg">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-stone-700">{t.example}
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} maxLength={MAX_EXAMPLE_CHARS} className={`${ADMIN_INPUT} mt-1`} />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-stone-400">{t.placeholders}</span>
              <span className="shrink-0 text-xs text-stone-400">{draft.length}/{MAX_EXAMPLE_CHARS}</span>
            </div>
            <button type="button" onClick={() => setDraft(suggestion(editing))} className="text-sm font-medium text-stone-600 underline">{t.useSuggestion}</button>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
              <button type="button" disabled={isSaving || !draft.trim()} onClick={() => save({ ...playbook, [editing]: { enabled: true, example: draft.trim() } })} className={ADMIN_PRIMARY_BUTTON}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isSaving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </CalendarModal>
      )}
    </div>
  );
}
