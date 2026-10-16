import { useEffect, useState } from 'react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_SURFACE } from '../adminUi';
import { MARKETING_TEXT } from './marketingText';
import { RunSummary, RunStats, loadRunStats, loadRuns } from './marketingApi';
import { useCurrency } from '../../../lib/currencyContext';

const REFRESH_MS = 15000;
// Opens and clicks are counted for emails sent after tracking went live.
const TRACKING_SINCE = Date.parse('2026-10-16T18:00:00Z');

interface CampaignHistoryProps {
  campaignId: string;
  refreshKey: number;
}

/** Per run: how many were sent, failed, still in progress. Refreshes while a run is in progress. */
export default function CampaignHistory({ campaignId, refreshKey }: CampaignHistoryProps) {
  const { t, locale } = useAdminText(MARKETING_TEXT);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<Map<string, RunStats>>(new Map());
  const { formatAmount } = useCurrency();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await loadRuns(campaignId);
        if (cancelled) return;
        setRuns(next);
        setError(false);
        loadRunStats(campaignId).then((s) => { if (!cancelled) setStats(s); }).catch((statsError) => console.error('Could not load campaign results:', statsError));
        if (next.some((run) => run.pending > 0)) timer = setTimeout(load, REFRESH_MS);
      } catch (loadError) {
        console.error('Could not load campaign history:', loadError);
        if (!cancelled) setError(true);
      }
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [campaignId, refreshKey]);

  const label = (run: RunSummary): string => {
    if (run.runKey.startsWith('test-')) return t.runTest;
    if (run.runKey.startsWith('now-')) {
      return fillText(t.runNow, { day: new Date(run.lastAt).toLocaleDateString(locale, { dateStyle: 'medium' }) });
    }
    const [year, month] = run.runKey.split('-').map(Number);
    return fillText(t.runMonthly, { month: new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) });
  };

  return (
    <section className={`${ADMIN_SURFACE} p-6`} aria-labelledby="campaign-history">
      <h3 id="campaign-history" className="mb-3 text-[15px] font-semibold text-[#1A1714]">{t.history}</h3>
      {error && <p role="alert" className="text-sm text-red-700">{t.loadFailed}</p>}
      {!error && runs.length === 0 && <p className="text-sm text-stone-400">{t.noHistory}</p>}
      <ul className="divide-y divide-stone-200/70">
        {runs.map((run) => (
          <li key={run.runKey} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span className="font-medium text-stone-700">{label(run)}</span>
            <span className="flex flex-wrap gap-3 text-xs tabular-nums text-stone-500">
              <span className="text-emerald-700">{run.sent} {t.sent}</span>
              {run.pending > 0 && <span className="text-amber-700">{run.pending} {t.pending}</span>}
              {run.failed > 0 && <span className="text-red-700">{run.failed} {t.failed}</span>}
              {run.skipped > 0 && <span>{run.skipped} {t.skipped}</span>}
            </span>
            {!run.runKey.startsWith('test-') && stats.get(run.runKey) && <RunResults stats={stats.get(run.runKey)!} t={t} money={(c) => formatAmount(c / 100)} />}
          </li>
        ))}
      </ul>
      {stats.size > 0 && <p className="mt-3 text-xs text-stone-400">{t.rHint}</p>}
    </section>
  );
}

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');

function RunResults({ stats, t, money }: { stats: RunStats; t: (typeof MARKETING_TEXT)['en']; money: (cents: number) => string }) {
  const isMeasured = stats.firstSentAt !== null && Date.parse(stats.firstSentAt) >= TRACKING_SINCE;
  const cell = (value: string, label: string) => (
    <span className="rounded-lg bg-stone-900/[0.04] px-2.5 py-1"><b className="font-semibold text-[#1A1714]">{value}</b> {label}</span>
  );
  return (
    <div className="flex w-full flex-wrap gap-1.5 text-xs tabular-nums text-stone-500">
      {isMeasured
        ? <>{cell(percent(stats.opened, stats.sent), t.rOpened)}{cell(percent(stats.clicked, stats.sent), t.rClicked)}</>
        : <span className="px-1 py-1 italic">{t.rNotMeasured}</span>}
      {cell(String(stats.unsubscribed), t.rUnsub)}
      {cell(`${stats.voucherSales} · ${money(stats.voucherCents)}`, t.rVouchers)}
      {cell(`${stats.bookings} · ${money(stats.bookingCents)}`, t.rBookings)}
    </div>
  );
}
