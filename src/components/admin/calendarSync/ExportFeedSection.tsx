import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, RotateCcw } from 'lucide-react';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { createFeedToken, feedUrl, getFeedToken } from './calendarSyncApi';

interface ExportFeedSectionProps {
  businessId: string;
  specialistId: string;
  specialistName: string;
}

const COPIED_RESET_MS = 2000;

export default function ExportFeedSection({ businessId, specialistId, specialistName }: ExportFeedSectionProps) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    getFeedToken(specialistId)
      .then((value) => !isCancelled && setToken(value))
      .catch((loadError) => {
        console.error('Could not load calendar link', loadError);
        if (!isCancelled) setError('The calendar link could not be loaded.');
      })
      .finally(() => !isCancelled && setIsLoading(false));
    return () => {
      isCancelled = true;
    };
  }, [specialistId]);

  const makeLink = async (isReplacing: boolean) => {
    if (isReplacing && !window.confirm('Create a new link? Calendars using the old link stop updating.')) return;
    setIsWorking(true);
    setError(null);
    try {
      setToken(await createFeedToken(businessId, specialistId));
    } catch (createError) {
      console.error('Could not create calendar link', createError);
      setError('The link could not be created. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const url = token ? feedUrl(token) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
    } catch {
      setError('Copying failed. Select the link and copy it manually.');
    }
  };

  return (
    <section aria-labelledby="calendar-export-heading" className="space-y-4">
      <div>
        <h3 id="calendar-export-heading" className="text-base font-semibold text-[#1A1714]">
          Show Zenno bookings in {specialistName}'s own calendar
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          A private link for Google, Apple or Outlook Calendar. Shows the treatment and the
          customer's first name. Keep it private: anyone with the link can see these bookings.
        </p>
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}

      {!isLoading && !token && (
        <button type="button" className={ADMIN_PRIMARY_BUTTON} disabled={isWorking} onClick={() => makeLink(false)}>
          {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create calendar link
        </button>
      )}

      {token && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className={`${ADMIN_INPUT} font-mono text-xs`} value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Calendar link" />
            <button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={copy}>
              {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {isCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <a
              className={ADMIN_TERTIARY_BUTTON}
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url.replace(/^https:/, 'webcal:'))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Google Calendar
            </a>
            <a className={ADMIN_TERTIARY_BUTTON} href={url.replace(/^https:/, 'webcal:')}>
              Add to Apple / Outlook
            </a>
            <button type="button" className={ADMIN_TERTIARY_BUTTON} disabled={isWorking} onClick={() => makeLink(true)}>
              <RotateCcw className="h-4 w-4" /> New link
            </button>
          </div>
          <p className="text-xs text-stone-500">Calendar apps refresh subscriptions on their own schedule (Google: every few hours).</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
