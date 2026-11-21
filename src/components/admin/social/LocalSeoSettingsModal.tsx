import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { LOCAL_SEO_TEXT } from './localSeoText';
import { saveLocalSeoSettings, syncProfileNow, type LocalSeoStatus } from './localSeoApi';

interface LocalSeoSettingsModalProps {
  status: LocalSeoStatus;
  onClose: () => void;
  onChanged: (status: LocalSeoStatus) => void;
}

/** Auto-reply and profile sync switches, plus the last sync result and "Sync now". */
export default function LocalSeoSettingsModal({ status, onClose, onChanged }: LocalSeoSettingsModalProps) {
  const { t, locale } = useAdminText(LOCAL_SEO_TEXT);
  const [settings, setSettings] = useState(status.settings);
  const [busy, setBusy] = useState<'save' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'save' | 'sync', action: () => Promise<LocalSeoStatus>, close: boolean) => {
    setBusy(kind);
    setError(null);
    try {
      const next = await action();
      onChanged(next);
      if (close) onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: keyof LocalSeoStatus['settings'], label: string, hint?: string) => (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={settings[key]} onChange={(e) => setSettings((current) => ({ ...current, [key]: e.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#1A1714]" />
      <span>
        <span className="block text-sm font-medium text-[#1A1714]">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-stone-500">{hint}</span>}
      </span>
    </label>
  );

  const { sync } = status;
  const formatDate = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="gbp-settings-title">
      <div className={`${ADMIN_MODAL} max-w-lg p-6`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="gbp-settings-title" className="text-lg font-semibold text-[#1A1714]">{t.settingsTitle}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className={ADMIN_TERTIARY_BUTTON}><X className="h-4 w-4" /></button>
        </div>
        <fieldset disabled={busy !== null} className="space-y-4">
          {toggle('autoReplyPositive', t.autoReply, t.autoReplyHint)}
          <div className="space-y-3 border-t border-stone-200/70 pt-4">
            {toggle('syncHours', t.syncHours)}
            {toggle('syncServices', t.syncServices)}
            <p className="text-xs text-stone-500">{t.syncHint}</p>
          </div>
        </fieldset>
        <div className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-600">
          {sync.lastError
            ? <span className="text-red-700">{fillText(t.syncError, { error: sync.lastError })}</span>
            : sync.dueAt ? t.syncPending
              : sync.lastSyncedAt ? fillText(t.lastSynced, { date: formatDate(sync.lastSyncedAt) }) : null}
          <button type="button" onClick={() => run('sync', syncProfileNow, false)} disabled={busy !== null} className={`${ADMIN_TERTIARY_BUTTON} mt-1 -ml-2`}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`} /> {busy === 'sync' ? t.syncing : t.syncNow}
          </button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
          <button type="button" onClick={() => run('save', () => saveLocalSeoSettings(settings), true)} disabled={busy !== null} className={ADMIN_PRIMARY_BUTTON}>{t.save}</button>
        </div>
      </div>
    </div>
  );
}
