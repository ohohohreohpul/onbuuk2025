import { useEffect, useState } from 'react';
import { Bot, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { summarizeSources, type SourceSummary } from '../../lib/bookingSources';
import { ADMIN_SURFACE } from './adminUi';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

// "Where your bookings come from" — main dashboard card (Jev decision,
// docs/DECISIONS.md). AI channels lead, because that is what owners pay for.

const WINDOW_DAYS = 30;

const TEXT: Translations<{
  heading: string; lastDays: string; loadError: string; aiOne: string; aiMany: string; mostly: string;
  empty: string; ai_booked: string; ai_referral: string; search: string; social: string; email: string;
  referral: string; direct: string; admin: string; import: string; untracked: string;
}> = {
  en: {
    heading: 'Where your bookings come from', lastDays: 'Last {count} days',
    loadError: 'Could not load booking sources.',
    aiOne: '{count} booking through AI assistants', aiMany: '{count} bookings through AI assistants',
    mostly: ', mostly {agent}', empty: 'No bookings in the last {count} days yet.',
    ai_booked: 'Booked by AI assistant', ai_referral: 'From an AI answer', search: 'Google & search',
    social: 'Social media', email: 'Email', referral: 'Other websites', direct: 'Direct',
    admin: 'Added by your team', import: 'Imported', untracked: 'Before tracking',
  },
  de: {
    heading: 'Herkunft der Buchungen', lastDays: 'Letzte {count} Tage',
    loadError: 'Buchungsquellen konnten nicht geladen werden.',
    aiOne: '{count} Buchung über KI-Assistenten', aiMany: '{count} Buchungen über KI-Assistenten',
    mostly: ', vor allem {agent}', empty: 'Noch keine Buchungen in den letzten {count} Tagen.',
    ai_booked: 'Von KI-Assistent gebucht', ai_referral: 'Über eine KI-Antwort', search: 'Google & Suche',
    social: 'Social Media', email: 'E-Mail', referral: 'Andere Websites', direct: 'Direkt',
    admin: 'Vom Team angelegt', import: 'Importiert', untracked: 'Vor dem Tracking',
  },
  th: {
    heading: 'การจองของคุณมาจากไหน', lastDays: '{count} วันล่าสุด',
    loadError: 'โหลดแหล่งที่มาของการจองไม่สำเร็จ',
    aiOne: '{count} การจองผ่านผู้ช่วย AI', aiMany: '{count} การจองผ่านผู้ช่วย AI',
    mostly: ' ส่วนใหญ่ผ่าน {agent}', empty: 'ยังไม่มีการจองใน {count} วันล่าสุด',
    ai_booked: 'จองโดยผู้ช่วย AI', ai_referral: 'มาจากคำตอบของ AI', search: 'Google และการค้นหา',
    social: 'โซเชียลมีเดีย', email: 'อีเมล', referral: 'เว็บไซต์อื่น', direct: 'เข้ามาโดยตรง',
    admin: 'เพิ่มโดยทีมของคุณ', import: 'นำเข้า', untracked: 'ก่อนเริ่มติดตาม',
  },
};

interface BookingSourcesCardProps {
  businessId: string;
}

export default function BookingSourcesCard({ businessId }: BookingSourcesCardProps) {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [hasError, setHasError] = useState(false);
  const { t } = useAdminText(TEXT);

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
          setHasError(true);
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
          {t.heading}
        </h2>
        <span className="text-xs text-stone-400">{fillText(t.lastDays, { count: WINDOW_DAYS })}</span>
      </div>

      {hasError && (
        <p className="mt-3 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" aria-hidden /> {t.loadError}
        </p>
      )}

      {summary && summary.aiTotal > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          <Bot className="h-4 w-4 shrink-0" aria-hidden />
          {fillText(summary.aiTotal === 1 ? t.aiOne : t.aiMany, { count: summary.aiTotal })}
          {summary.topAiAgent ? fillText(t.mostly, { agent: summary.topAiAgent }) : ''}
        </p>
      )}

      {summary && summary.total === 0 && (
        <p className="mt-4 text-sm text-stone-400">{fillText(t.empty, { count: WINDOW_DAYS })}</p>
      )}

      {summary && summary.total > 0 && (
        <ul className="mt-4 space-y-2.5">
          {summary.buckets.map((b) => (
            <li key={b.channel}>
              <div className="flex items-center justify-between text-sm">
                <span className={b.isAi ? 'font-medium text-emerald-800' : 'text-stone-600'}>{t[b.channel] ?? b.label}</span>
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
