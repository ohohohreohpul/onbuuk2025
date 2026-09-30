import { useEffect, useState } from 'react';
import { Bot, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { summarizeSources, type SourceSummary } from '../../lib/bookingSources';
import { ADMIN_SURFACE } from './adminUi';

// "Where your bookings come from" — main dashboard card (Jev decision,
// docs/DECISIONS.md). AI channels lead, because that is what owners pay for.

const WINDOW_DAYS = 30;

interface BookingSourcesCardProps {
  businessId: string;
}

export default function BookingSourcesCard({ businessId }: BookingSourcesCardProps) {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let isCancelled = false;
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

    supabase
      .from('bookings')
      .select('channel, ai_agent')
      .eq('business_id', businessId)
      .neq('status', 'cancelled')
      .gte('created_at', since)
      .then(({ data, error: queryError }) => {
        if (isCancelled) return;
        if (queryError) {
          console.error('Booking sources failed to load', queryError);
          setError('Could not load booking sources.');
          return;
        }
        setSummary(summarizeSources(data ?? []));
      });

    return () => {
      isCancelled = true;
    };
  }, [businessId]);

  return (
    <section className={`${ADMIN_SURFACE} p-5`} aria-labelledby="booking-sources-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="booking-sources-heading" className="text-base font-semibold text-[#1A1714]">
          Where your bookings come from
        </h2>
        <span className="text-xs text-stone-400">Last {WINDOW_DAYS} days</span>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" aria-hidden /> {error}
        </p>
      )}

      {summary && summary.aiTotal > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          <Bot className="h-4 w-4 shrink-0" aria-hidden />
          {summary.aiTotal} {summary.aiTotal === 1 ? 'booking' : 'bookings'} through AI assistants
          {summary.topAiAgent ? `, mostly ${summary.topAiAgent}` : ''}
        </p>
      )}

      {summary && summary.total === 0 && (
        <p className="mt-4 text-sm text-stone-400">No bookings in the last {WINDOW_DAYS} days yet.</p>
      )}

      {summary && summary.total > 0 && (
        <ul className="mt-4 space-y-2.5">
          {summary.buckets.map((b) => (
            <li key={b.channel}>
              <div className="flex items-center justify-between text-sm">
                <span className={b.isAi ? 'font-medium text-emerald-800' : 'text-stone-600'}>{b.label}</span>
                <span className="tabular-nums text-stone-500">{b.count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden>
                <div
                  className={`h-full origin-left rounded-full ${b.isAi ? 'bg-emerald-500' : b.channel === 'untracked' ? 'bg-stone-200' : 'bg-stone-400'}`}
                  style={{ transform: `scaleX(${Math.max(b.share, 0.02)})` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
