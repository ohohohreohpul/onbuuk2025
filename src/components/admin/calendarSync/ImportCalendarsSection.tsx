import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  ADMIN_INPUT,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_TERTIARY_BUTTON,
} from '../adminUi';
import {
  addCalendar,
  listCalendars,
  removeCalendar,
  setCalendarActive,
  syncCalendars,
  validateCalendarLink,
  type ExternalCalendar,
} from './calendarSyncApi';

interface ImportCalendarsSectionProps {
  businessId: string;
  specialistId: string;
}

const WHERE_TO_FIND = [
  { name: 'Google Calendar', how: 'Settings → pick the calendar → "Secret address in iCal format"' },
  { name: 'Outlook', how: 'Settings → Calendar → Shared calendars → Publish → ICS link' },
  { name: 'Apple iCloud', how: 'Share calendar → Public calendar → copy link' },
  { name: 'Treatwell & others', how: 'Use the calendar export / iCal link from their settings' },
];

function formatSynced(calendar: ExternalCalendar): string {
  if (!calendar.last_synced_at) return 'Not synced yet';
  const minutes = Math.round((Date.now() - new Date(calendar.last_synced_at).getTime()) / 60_000);
  const when = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : new Date(calendar.last_synced_at).toLocaleString();
  return `${calendar.busy_count} busy ${calendar.busy_count === 1 ? 'time' : 'times'} · synced ${when}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function ImportCalendarsSection({ businessId, specialistId }: ImportCalendarsSectionProps) {
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCalendars(await listCalendars(specialistId));
      setLoadError(null);
    } catch (error) {
      console.error('Could not load calendars', error);
      setLoadError('Linked calendars could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [specialistId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateCalendarLink(link);
    if (problem) {
      setFormError(problem);
      return;
    }
    setIsAdding(true);
    setFormError(null);
    try {
      const created = await addCalendar({ businessId, specialistId, name, link });
      setName('');
      setLink('');
      await syncCalendars(created.id).catch((error) => console.error('First sync failed', error));
      await refresh();
    } catch (error) {
      setFormError(errorText(error));
    } finally {
      setIsAdding(false);
    }
  };

  const runAction = async (calendarId: string, action: () => Promise<unknown>) => {
    setBusyId(calendarId);
    try {
      await action();
      await refresh();
    } catch (error) {
      console.error('Calendar action failed', error);
      setLoadError(errorText(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="calendar-import-heading" className="space-y-4">
      <div>
        <h3 id="calendar-import-heading" className="text-base font-semibold text-[#1A1714]">
          Block times from other calendars
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          Appointments from Treatwell, Google or any other calendar become busy times here, so
          customers can't book them twice. Only the times are copied, never names or notes.
          Refreshes every 10 minutes.
        </p>
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {calendars.length > 0 && (
        <ul className="divide-y divide-stone-200/70 rounded-2xl border border-stone-200/70 bg-white/70">
          {calendars.map((calendar) => (
            <li key={calendar.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {calendar.last_error ? (
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-label="Problem" />
              ) : (
                <CheckCircle2 className={`h-5 w-5 shrink-0 ${calendar.is_active ? 'text-emerald-600' : 'text-stone-300'}`} aria-label={calendar.is_active ? 'Working' : 'Paused'} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1A1714]">{calendar.name}</p>
                <p className={`text-xs ${calendar.last_error ? 'text-amber-700' : 'text-stone-500'}`}>
                  {!calendar.is_active ? 'Paused' : calendar.last_error ?? formatSynced(calendar)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={ADMIN_TERTIARY_BUTTON}
                  disabled={busyId === calendar.id || !calendar.is_active}
                  onClick={() => runAction(calendar.id, () => syncCalendars(calendar.id))}
                  title="Sync now"
                >
                  <RefreshCw className={`h-4 w-4 ${busyId === calendar.id ? 'animate-spin' : ''}`} />
                  <span className="sr-only sm:not-sr-only">Sync</span>
                </button>
                <button
                  type="button"
                  className={ADMIN_TERTIARY_BUTTON}
                  disabled={busyId === calendar.id}
                  onClick={() => runAction(calendar.id, () => setCalendarActive(calendar.id, !calendar.is_active))}
                >
                  {calendar.is_active ? 'Pause' : 'Resume'}
                </button>
                <button
                  type="button"
                  className={`${ADMIN_TERTIARY_BUTTON} hover:text-red-600`}
                  disabled={busyId === calendar.id}
                  onClick={() => {
                    if (window.confirm(`Remove "${calendar.name}"? Its busy times will be freed.`)) {
                      runAction(calendar.id, () => removeCalendar(calendar.id));
                    }
                  }}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="space-y-3 rounded-2xl border border-dashed border-stone-300 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-stone-700">Name</span>
            <input className={ADMIN_INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Treatwell" maxLength={80} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-stone-700">Calendar link (iCal / ICS)</span>
            <input
              className={ADMIN_INPUT}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <details className="text-xs text-stone-500">
            <summary className="cursor-pointer select-none font-medium text-stone-600">Where do I find this link?</summary>
            <ul className="mt-2 space-y-1">
              {WHERE_TO_FIND.map((item) => (
                <li key={item.name}><span className="font-medium text-stone-700">{item.name}:</span> {item.how}</li>
              ))}
            </ul>
          </details>
          <button type="submit" className={ADMIN_PRIMARY_BUTTON} disabled={isAdding}>
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Link calendar
          </button>
        </div>
      </form>

      {calendars.length > 1 && (
        <button type="button" className={ADMIN_SECONDARY_BUTTON} disabled={busyId !== null} onClick={() => runAction('all', () => syncCalendars())}>
          <RefreshCw className="h-4 w-4" /> Sync all now
        </button>
      )}
    </section>
  );
}
