import { useMemo, useState, type ReactNode } from 'react';
import { Check, Globe, Loader2, Sparkles } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { updateSettings, type Briefing, type Habit, type Overview } from './receptionistApi';
import { BRIEFING_TEXT, EMOJI_STYLES, HABITS, INITIATIVES, LENGTHS, PERSONALITIES } from './briefingText';
import { openWidgetPreview } from './widgetPreview';
import LearnFromWebsiteModal from './LearnFromWebsiteModal';

const MAX_BRIEFING_CHARS = 1500;
const DEFAULT_BRIEFING: Briefing = {
  personality: 'warm', emoji: 'mirror', length: 'short', initiative: 'guide',
  habits: ['introduce_self', 'ask_needs_first', 'offer_alternatives'], briefing: '',
};

function withDefaults(stored: Partial<Briefing> | undefined): Briefing {
  return { ...DEFAULT_BRIEFING, ...(stored ?? {}), habits: Array.isArray(stored?.habits) ? stored.habits : DEFAULT_BRIEFING.habits };
}

interface BriefingPanelProps {
  overview: Overview;
  onOverview: (overview: Overview) => void;
}

/** "Personality": who the receptionist is and how she treats guests, with a live sample reply. */
export default function BriefingPanel({ overview, onOverview }: BriefingPanelProps) {
  const { t, lang } = useAdminText(BRIEFING_TEXT);
  const saved = useMemo(() => withDefaults(overview.settings.playbook), [overview.settings.playbook]);
  const [draft, setDraft] = useState<Briefing>(saved);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isLearning, setIsLearning] = useState(false);
  const [learned, setLearned] = useState(false);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof Briefing>(key: K, value: Briefing[K]) => { setDraft((d) => ({ ...d, [key]: value })); setJustSaved(false); };
  const applySuggestion = (suggestion: Omit<Briefing, 'habits'>) => {
    setDraft((d) => ({ ...d, ...suggestion }));
    setIsLearning(false);
    setLearned(true);
    setJustSaved(false);
  };
  const toggleHabit = (habit: Habit) => set('habits', draft.habits.includes(habit) ? draft.habits.filter((h) => h !== habit) : [...draft.habits, habit]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const next = await updateSettings({ playbook: { ...draft, briefing: draft.briefing.trim() } });
      onOverview(next);
      setDraft(withDefaults(next.settings.playbook));
      setJustSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className={`${ADMIN_SURFACE} divide-y divide-stone-200/70`}>
        <header className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div className="max-w-xl">
            <h2 className="font-semibold text-[#1A1714]">{t.title}</h2>
            <p className="mt-0.5 text-sm text-stone-500">{t.hint}</p>
          </div>
          <button type="button" onClick={() => setIsLearning(true)} className={`${ADMIN_SECONDARY_BUTTON} py-2`}><Globe className="h-4 w-4" />{t.learn}</button>
          {learned && isDirty && (
            <p className="w-full rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">{t.learnDone}</p>
          )}
        </header>

        <Section title={t.personality}>
          <div className="grid gap-2 sm:grid-cols-2">
            {PERSONALITIES.map((p) => (
              <button key={p} type="button" onClick={() => set('personality', p)} aria-pressed={draft.personality === p}
                className={`relative rounded-xl border px-3.5 py-2.5 text-left transition ${draft.personality === p ? 'border-[#1A1714] bg-white ring-1 ring-[#1A1714]' : 'border-stone-200 bg-white/60 hover:border-stone-400'}`}>
                <span className="block text-sm font-semibold text-[#1A1714]">{t[`p_${p}`]}</span>
                <span className="block text-xs text-stone-500">{t[`p_${p}Hint`]}</span>
                {draft.personality === p && <Check className="absolute right-3 top-3 h-4 w-4 text-[#1A1714]" />}
              </button>
            ))}
          </div>
        </Section>

        <div className="grid gap-x-6 sm:grid-cols-2">
          <Section title={t.length}>
            <Choice options={LENGTHS.map((v) => ({ value: v, label: t[`l_${v}`] }))} value={draft.length} onChange={(v) => set('length', v)} />
          </Section>
          <Section title={t.emoji}>
            <Choice options={EMOJI_STYLES.map((v) => ({ value: v, label: t[`e_${v}`] }))} value={draft.emoji} onChange={(v) => set('emoji', v)} />
          </Section>
        </div>

        <Section title={t.initiative}>
          <Choice options={INITIATIVES.map((v) => ({ value: v, label: t[`i_${v}`] }))} value={draft.initiative} onChange={(v) => set('initiative', v)} />
          <p className="mt-1.5 text-xs text-stone-500">{t[`i_${draft.initiative}Hint`]}</p>
        </Section>

        <Section title={t.habits} hint={t.habitsHint}>
          <div className="flex flex-wrap gap-1.5">
            {HABITS.map((h) => {
              const isOn = draft.habits.includes(h);
              return (
                <button key={h} type="button" onClick={() => toggleHabit(h)} aria-pressed={isOn}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${isOn ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 bg-white/70 text-stone-600 hover:border-stone-400'}`}>
                  {isOn && <Check className="h-3.5 w-3.5" />}{t[`h_${h}`]}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t.briefing} hint={t.briefingHint}>
          <textarea value={draft.briefing} onChange={(e) => set('briefing', e.target.value)} rows={5} maxLength={MAX_BRIEFING_CHARS}
            placeholder={t.briefingPlaceholder} className={ADMIN_INPUT} />
          <p className="mt-1 text-right text-xs text-stone-400">{draft.briefing.length}/{MAX_BRIEFING_CHARS}</p>
        </Section>

        <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-3">
          {error && <p role="alert" className="mr-auto text-sm text-red-700">{error}</p>}
          {!error && isDirty && <span className="mr-auto text-xs font-medium text-amber-700">{t.unsaved}</span>}
          {!error && !isDirty && justSaved && <span className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" />{t.saved}</span>}
          {isDirty && <button type="button" onClick={() => setDraft(saved)} className={ADMIN_TERTIARY_BUTTON}>{t.reset}</button>}
          <button type="button" onClick={save} disabled={!isDirty || isSaving} className={ADMIN_PRIMARY_BUTTON}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isSaving ? t.saving : t.save}
          </button>
        </footer>
      </div>

      {isLearning && <LearnFromWebsiteModal language={lang} t={t} onClose={() => setIsLearning(false)} onSuggestion={applySuggestion} />}

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <SamplePreview draft={draft} assistant={overview.settings.assistant_name} shop={overview.status.shopName ?? ''} t={t} />
        <button type="button" onClick={() => openWidgetPreview(overview.settings.widget_key)} disabled={!overview.settings.is_enabled}
          className={`${ADMIN_TERTIARY_BUTTON} mt-2 w-full`}><Sparkles className="h-4 w-4" />{t.tryIt}</button>
      </aside>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="px-5 py-4">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
      {hint && <p className="mb-2 mt-0.5 text-xs text-stone-400">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </section>
  );
}

function Choice<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="inline-flex w-full rounded-xl bg-stone-900/[0.05] p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[13px] font-medium transition ${value === o.value ? 'bg-white text-[#1A1714] shadow-sm' : 'text-stone-500 hover:text-[#1A1714]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

type BriefingText = (typeof BRIEFING_TEXT)['en'];

function SamplePreview({ draft, assistant, shop, t }: { draft: Briefing; assistant: string; shop: string; t: BriefingText }) {
  const p = draft.personality;
  const shopName = shop || '…';
  const intro = assistant.trim() ? fillText(t.introNamed, { name: assistant.trim(), shop: shopName }) : fillText(t.introShop, { shop: shopName });
  const parts = [fillText(t[`p_${p}Sample`], { intro })];
  if (draft.length !== 'short') parts.push(t[`p_${p}More`]);
  const reply = parts.join(' ') + (draft.emoji === 'sometimes' ? ' 😊' : '');
  return (
    <div className={`${ADMIN_SURFACE} overflow-hidden`}>
      <p className="border-b border-stone-200/70 px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide text-stone-500">{t.preview}</p>
      <div className="space-y-2 bg-[#EFEAE2] p-4">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#D9FDD3] px-3 py-2 text-sm text-stone-800 shadow-sm">{t.previewCustomer}</p>
        <p key={reply} className="w-fit max-w-[90%] animate-[fadeIn_0.25s_ease-out] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm text-stone-800 shadow-sm">{reply}</p>
      </div>
    </div>
  );
}
