import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgePercent, CalendarClock, Clock, Gift, HelpCircle, MessageSquareText, Scissors, Users } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { useCurrency } from '../../../lib/currencyContext';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { updateSettings, type Overview, type ReceptionistSettings } from './receptionistApi';
import { RECEPTIONIST_TEXT } from './receptionistText';
import { loadKnowledge, type KnowledgeData } from './knowledgeData';
import { FaqModal, StyleModal, type FaqEntry } from './KnowledgeModals';

interface KnowledgePanelProps {
  overview: Overview;
  onOverview: (overview: Overview) => void;
  onNavigate?: (view: string) => void;
}

function Section({ icon: Icon, title, action, children }: { icon: typeof Clock; title: string; action: ReactNode; children: ReactNode }) {
  return (
    <section className={`${ADMIN_SURFACE} p-5`}>
      <header className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]"><Icon className="h-4 w-4" /></span>
        <h3 className="flex-1 font-semibold text-[#1A1714]">{title}</h3>
        {action}
      </header>
      <div className="text-sm text-stone-700">{children}</div>
    </section>
  );
}

/** Read-only picture of what the receptionist knows; every part is changed where it lives. */
export default function KnowledgePanel({ overview, onOverview, onNavigate }: KnowledgePanelProps) {
  const { t, locale } = useAdminText(RECEPTIONIST_TEXT);
  const { formatPrice } = useCurrency();
  const { settings } = overview;
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [hasError, setHasError] = useState(false);
  const [modal, setModal] = useState<'faq' | 'style' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const faq: FaqEntry[] = settings.faq ?? [];
  const addressForm = settings.address_form ?? 'sie';

  const load = useCallback(() => {
    loadKnowledge(settings.business_id).then(setData).catch((error) => {
      console.error('Could not load what the receptionist knows:', error);
      setHasError(true);
    });
  }, [settings.business_id]);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<ReceptionistSettings>) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      onOverview(await updateSettings(patch));
      setModal(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  const goTo = (view: string) => onNavigate && (
    <button type="button" onClick={() => onNavigate(view)} className={`${ADMIN_SECONDARY_BUTTON} py-2`}>
      {t.change}<ArrowUpRight className="h-4 w-4" />
    </button>
  );
  const editButton = (target: 'faq' | 'style') => (
    <button type="button" onClick={() => { setSaveError(null); setModal(target); }} className={`${ADMIN_SECONDARY_BUTTON} py-2`}>{t.edit}</button>
  );
  const weekday = (day: number) => new Date(2024, 0, 7 + day).toLocaleDateString(locale, { weekday: 'long' });
  const empty = <p className="text-stone-400">{t.nothingYet}</p>;

  if (hasError) return <p className={`${ADMIN_SURFACE} p-6 text-sm text-red-700`}>{t.loadFailed}</p>;
  if (!data) return <div className="flex justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-900" /></div>;

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h2 className="font-semibold text-[#1A1714]">{t.knowledgeTitle}</h2>
        <p className="text-sm text-stone-500">{t.knowledgeHint}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={Scissors} title={t.secTreatments} action={goTo('services')}>
          {data.treatments.length === 0 ? empty : (
            <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto">
              {data.treatments.map((treatment) => (
                <li key={treatment.name} className="flex justify-between gap-3 py-1.5">
                  <span className="font-medium">{treatment.name}</span>
                  <span className="shrink-0 text-right tabular-nums text-stone-500">
                    {treatment.options.map((o) => `${o.minutes} Min. ${formatPrice(o.priceCents)}`).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="space-y-4">
          <Section icon={Users} title={t.secTherapists} action={goTo('specialists')}>
            {data.therapists.length === 0 ? empty : (
              <p>{data.therapists.map((s) => s.name).join(', ')}</p>
            )}
          </Section>
          <Section icon={Clock} title={t.secHours} action={goTo('specialists')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {data.hours.map((h) => (
                <div key={h.day} className="contents">
                  <dt className="text-stone-500">{weekday(h.day)}</dt>
                  <dd className="tabular-nums">{h.range ?? t.closedDay}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>

        <Section icon={Gift} title={t.secVouchers} action={goTo('loyalty')}>
          {data.valueAmountsCents.length === 0 && data.sets.length === 0 && data.passes.length === 0 ? empty : (
            <ul className="space-y-1">
              {data.valueAmountsCents.length > 0 && <li><span className="font-medium">{t.valueVouchers}:</span> {data.valueAmountsCents.map(formatPrice).join(', ')}</li>}
              {data.sets.map((set) => <li key={set.name}>{set.name} – {formatPrice(set.priceCents)}</li>)}
              {data.passes.map((pass) => <li key={pass.name}>{pass.name} ({pass.visits}×) – {formatPrice(pass.priceCents)}</li>)}
            </ul>
          )}
        </Section>

        <div className="space-y-4">
          <Section icon={BadgePercent} title={t.secPromotion} action={goTo('loyalty')}>
            {data.promotion ? (
              <p><span className="font-medium">{data.promotion.title}</span>{data.promotion.text ? ` – ${data.promotion.text}` : ''}</p>
            ) : <p className="text-stone-400">{t.noPromotion}</p>}
          </Section>
          <Section icon={CalendarClock} title={t.secRules} action={goTo('agents')}>
            <p>{data.isAutoConfirm ? t.rulesAuto : t.rulesManual}</p>
          </Section>
        </div>

        <Section icon={HelpCircle} title={t.secFaq} action={editButton('faq')}>
          {faq.length === 0 ? <p className="text-stone-400">{t.faqEmpty}</p> : (
            <dl className="space-y-2">
              {faq.map((item) => (
                <div key={item.question}>
                  <dt className="font-medium">{item.question}</dt>
                  <dd className="text-stone-600">{item.answer}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        <Section icon={MessageSquareText} title={t.secStyle} action={editButton('style')}>
          <p>{settings.assistant_name} · {addressForm === 'du' ? t.formDu : t.formSie}</p>
        </Section>
      </div>

      {modal === 'faq' && (
        <FaqModal t={t} entries={faq} isSaving={isSaving} error={saveError} onClose={() => setModal(null)} onSave={(entries) => save({ faq: entries })} />
      )}
      {modal === 'style' && (
        <StyleModal t={t} name={settings.assistant_name} addressForm={addressForm} isSaving={isSaving} error={saveError}
          onClose={() => setModal(null)} onSave={(name, form) => save({ assistant_name: name, address_form: form })} />
      )}
    </div>
  );
}
