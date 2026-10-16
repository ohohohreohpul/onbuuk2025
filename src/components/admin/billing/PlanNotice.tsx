import { Sparkles } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { BILLING_TEXT } from './billingText';
import type { BillingOverview } from './billingApi';

interface PlanNoticeProps {
  overview: BillingOverview | null;
  canUpgrade: boolean;
  onUpgrade: () => void;
}

/** Sidebar line under the profile: the plan, and on Free a one-tap way to upgrade. */
export default function PlanNotice({ overview, canUpgrade, onUpgrade }: PlanNoticeProps) {
  const { t } = useAdminText(BILLING_TEXT);
  if (!overview) return null;
  if (overview.plan !== 'free') {
    return <p className="mt-2 px-1 text-[11px] font-medium uppercase tracking-wider text-white/40">{overview.plan === 'custom' ? t.onCustom : t.onZenno}</p>;
  }
  return (
    <button
      type="button"
      onClick={onUpgrade}
      disabled={!canUpgrade}
      className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-left text-xs text-white/70 ring-1 ring-white/10 transition hover:bg-white/[0.1] hover:text-white disabled:cursor-default disabled:hover:bg-white/[0.06]"
    >
      <span>{t.onFree}</span>
      {canUpgrade && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-[#1A1714]"><Sparkles className="h-3 w-3" />{t.upgrade}</span>}
    </button>
  );
}
