import { useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { buyPack, euro, PACKS, repliesLeft, type BillingOverview, type PackKey } from './billingApi';
import { BILLING_TEXT } from './billingText';

interface AiRepliesCardProps {
  overview: BillingOverview;
  onUpgrade?: () => void;
}

/** Monthly AI replies used, extra replies left, and the packs to buy more. */
export default function AiRepliesCard({ overview, onUpgrade }: AiRepliesCardProps) {
  const { t, locale } = useAdminText(BILLING_TEXT);
  const [busyPack, setBusyPack] = useState<PackKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const number = (n: number) => n.toLocaleString(locale);

  const buy = async (pack: PackKey) => {
    setBusyPack(pack);
    setError(null);
    try {
      window.location.href = await buyPack(pack);
    } catch (buyError) {
      setError(buyError instanceof Error ? buyError.message : t.failed);
      setBusyPack(null);
    }
  };

  if (overview.plan === 'free') {
    return (
      <section className={`${ADMIN_SURFACE} flex flex-wrap items-center justify-between gap-3 p-5`}>
        <p className="flex items-center gap-2 text-sm text-stone-700"><MessageCircle className="h-4 w-4" />{t.aiFree}</p>
        {onUpgrade && <button type="button" onClick={onUpgrade} className={ADMIN_SECONDARY_BUTTON}>{t.upgrade}</button>}
      </section>
    );
  }

  const usedShare = overview.allowance > 0 ? Math.min(1, overview.used / overview.allowance) : 1;
  const left = repliesLeft(overview);
  return (
    <section className={`${ADMIN_SURFACE} space-y-4 p-5`}>
      <header>
        <h3 className="flex items-center gap-2 font-semibold text-[#1A1714]"><MessageCircle className="h-4 w-4" />{t.aiTitle}</h3>
        <p className="mt-0.5 text-sm text-stone-500">{t.aiHint}</p>
      </header>
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-[#1A1714]">{fillText(t.aiUsed, { used: number(overview.used), allowance: number(overview.allowance) })}</span>
          <span className="text-stone-500">
            {overview.purchased > 0 && <>{fillText(t.aiExtra, { count: number(overview.purchased) })} · </>}
            {fillText(t.aiLeft, { count: number(left) })}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-900/[0.06]" role="progressbar" aria-valuenow={Math.round(usedShare * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${usedShare >= 0.9 ? 'bg-amber-500' : 'bg-[#1A1714]'}`} style={{ width: `${usedShare * 100}%` }} />
        </div>
        {left === 0 && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t.aiEmpty}</p>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {PACKS.map((pack) => (
          <div key={pack.key} className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 ring-1 ring-stone-900/[0.06]">
            <div>
              <p className="text-sm font-semibold text-[#1A1714]">{fillText(t.replies, { count: number(pack.replies) })}</p>
              <p className="text-xs text-stone-500 tabular-nums">{euro(pack.priceCents, locale)}</p>
            </div>
            <button type="button" onClick={() => buy(pack.key)} disabled={busyPack !== null} className={`${ADMIN_SECONDARY_BUTTON} px-3 py-1.5`}>
              {busyPack === pack.key ? <Loader2 className="h-4 w-4 animate-spin" /> : t.buy}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-400">{t.packHint}</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
