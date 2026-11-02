import { CalendarHeart, Cake, HeartHandshake, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { hostUrl, shopUrl } from '../../../lib/tenantHost';
import { ADMIN_SECONDARY_BUTTON, ADMIN_STATUS_PILL, ADMIN_SURFACE, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { AUTOMATION_STARTERS, AUTOMATION_TEXT, type StarterKind } from './automationText';
import { AudienceCounts, Campaign, CampaignDraft, starterDraft } from './marketingApi';

interface AutomationsSectionProps {
  campaigns: Campaign[];
  counts: AudienceCounts;
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: (draft: CampaignDraft) => void;
}

/** Birthday + win-back (one each per shop) and the list of special days; each row opens the editor. */
export default function AutomationsSection({ campaigns, counts, loading, onOpen, onCreate }: AutomationsSectionProps) {
  const { subdomain, customDomain } = useTenant();
  const { t, lang, locale } = useAdminText(AUTOMATION_TEXT);
  const bookingUrl = customDomain ? hostUrl(customDomain) : subdomain ? shopUrl(subdomain) : '';
  const create = (kind: StarterKind) => onCreate(starterDraft(kind, AUTOMATION_STARTERS[lang][kind], bookingUrl));
  const specialDays = campaigns.filter((c) => c.kind === 'special_day').sort((x, y) => (x.send_on ?? '').localeCompare(y.send_on ?? ''));
  const formatDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  const statusPill = (campaign: Campaign | undefined) => (
    <span className={`${ADMIN_STATUS_PILL} ${campaign?.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
      {campaign?.is_active ? t.on : t.off}
    </span>
  );

  const automationRow = (kind: 'birthday' | 'winback', icon: ReactNode, title: string, hint: string, extra?: string) => {
    const campaign = campaigns.find((c) => c.kind === kind);
    return (
      <li key={kind} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 gap-3">
          <span className="mt-0.5 text-stone-400">{icon}</span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-[#1A1714]">{title}</span>
              {statusPill(campaign)}
            </span>
            <span className="mt-1 block text-sm text-stone-500">{hint}</span>
            {extra && <span className="mt-1 block text-xs text-stone-400">{extra}</span>}
          </span>
        </span>
        <button type="button" disabled={loading} onClick={() => (campaign ? onOpen(campaign.id) : create(kind))} className={`${ADMIN_SECONDARY_BUTTON} shrink-0`}>
          {campaign ? t.edit : t.setUp}
        </button>
      </li>
    );
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">{t.sectionTitle}</h2>
        <p className="mt-0.5 text-sm text-stone-500">{t.sectionHint}</p>
      </div>
      <ul className={`${ADMIN_SURFACE} divide-y divide-stone-200/70`}>
        {automationRow('birthday', <Cake className="h-5 w-5" strokeWidth={1.5} />, t.birthdayTitle, t.birthdayHint,
          loading ? undefined : fillText(t.birthdaysKnown, { count: counts.with_birthday }))}
        {automationRow('winback', <HeartHandshake className="h-5 w-5" strokeWidth={1.5} />, t.winbackTitle, t.winbackHint)}
        <li className="p-5">
          <span className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex min-w-0 gap-3">
              <span className="mt-0.5 text-stone-400"><CalendarHeart className="h-5 w-5" strokeWidth={1.5} /></span>
              <span>
                <span className="block text-[15px] font-semibold text-[#1A1714]">{t.specialTitle}</span>
                <span className="mt-1 block text-sm text-stone-500">{t.specialHint}</span>
              </span>
            </span>
            <button type="button" disabled={loading} onClick={() => create('special_day')} className={`${ADMIN_TERTIARY_BUTTON} shrink-0`}>
              <Plus className="h-4 w-4" /> {t.newSpecialDay}
            </button>
          </span>
          {specialDays.length > 0 && (
            <ul className="mt-3 space-y-2 pl-8">
              {specialDays.map((campaign) => (
                <li key={campaign.id} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[#1A1714]">{campaign.subject}</span>
                      {statusPill(campaign)}
                    </span>
                    {campaign.send_on && <span className="block text-xs text-stone-500">{formatDate(campaign.send_on)}</span>}
                  </span>
                  <button type="button" onClick={() => onOpen(campaign.id)} className={`${ADMIN_TERTIARY_BUTTON} shrink-0`}>{t.edit}</button>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>
      {!loading && counts.pending > 0 && <p className="text-xs text-stone-500">{fillText(t.pendingOptIns, { count: counts.pending })}</p>}
    </section>
  );
}
