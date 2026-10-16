import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { updateSettings, type Overview } from './receptionistApi';
import { RECEPTIONIST_TEXT } from './receptionistText';

const MAX_KNOWLEDGE = 12000;
const MAX_INSTRUCTIONS = 4000;

interface KnowledgePanelProps {
  overview: Overview;
  onOverview: (overview: Overview) => void;
}

export default function KnowledgePanel({ overview, onOverview }: KnowledgePanelProps) {
  const { t } = useAdminText(RECEPTIONIST_TEXT);
  const { settings } = overview;
  const [name, setName] = useState(settings.assistant_name);
  const [knowledge, setKnowledge] = useState(settings.knowledge);
  const [instructions, setInstructions] = useState(settings.instructions);
  const [counts, setCounts] = useState({ services: 0, staff: 0, vouchers: 0 });
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  useEffect(() => {
    const businessId = settings.business_id;
    Promise.all([
      supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('specialists').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_active', true),
      supabase.from('gift_card_packages').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_active', true),
      supabase.from('service_pass_offers').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_active', true),
    ]).then(([services, staff, sets, passes]) => setCounts({
      services: services.count ?? 0, staff: staff.count ?? 0, vouchers: (sets.count ?? 0) + (passes.count ?? 0),
    }));
  }, [settings.business_id]);

  const save = async () => {
    setState('saving');
    try {
      onOverview(await updateSettings({ assistant_name: name, knowledge, instructions }));
      setState('saved');
    } catch (error) {
      console.error('Could not save receptionist knowledge:', error);
      setState('failed');
    }
  };

  return (
    <section className={`${ADMIN_SURFACE} space-y-5 p-6`}>
      <header>
        <h2 className="font-semibold text-[#1A1714]">{t.knowledgeTitle}</h2>
        <p className="text-sm text-stone-500">{t.knowledgeHint}</p>
      </header>
      <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <Sparkles className="h-4 w-4 shrink-0" />
        {fillText(t.autoKnows, counts)}
      </p>
      <label className="block text-sm font-medium text-stone-700">{t.assistantName}
        <input value={name} onChange={(e) => { setName(e.target.value); setState('idle'); }} maxLength={40} className={`${ADMIN_INPUT} mt-1 max-w-xs`} />
      </label>
      <label className="block text-sm font-medium text-stone-700">{t.knowledge}
        <textarea value={knowledge} onChange={(e) => { setKnowledge(e.target.value); setState('idle'); }} rows={8} maxLength={MAX_KNOWLEDGE} placeholder={t.knowledgePlaceholder} className={`${ADMIN_INPUT} mt-1`} />
        <span className="mt-1 block text-right text-xs text-stone-400">{knowledge.length} / {MAX_KNOWLEDGE}</span>
      </label>
      <label className="block text-sm font-medium text-stone-700">{t.instructions}
        <textarea value={instructions} onChange={(e) => { setInstructions(e.target.value); setState('idle'); }} rows={4} maxLength={MAX_INSTRUCTIONS} placeholder={t.instructionsPlaceholder} className={`${ADMIN_INPUT} mt-1`} />
      </label>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === 'saving'} className={ADMIN_PRIMARY_BUTTON}>
          {state === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}{state === 'saving' ? t.saving : t.save}
        </button>
        {state === 'saved' && <span className="text-sm text-emerald-700">{t.saved}</span>}
        {state === 'failed' && <span className="text-sm text-red-700">{t.saveFailed}</span>}
      </div>
    </section>
  );
}
