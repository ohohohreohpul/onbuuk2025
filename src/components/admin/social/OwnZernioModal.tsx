import { useState } from 'react';
import { X } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_INPUT, ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { OWN_ZERNIO_TEXT } from './ownZernioText';
import { connectOwnZernio, disconnectOwnZernio, type SocialAccount } from './socialApi';

interface OwnZernioModalProps {
  ownZernio: boolean;
  hasActiveAccounts: boolean;
  onClose: () => void;
  onChanged: (ownZernio: boolean, accounts: SocialAccount[]) => void;
}

/** Owner popup: run Social on the shop's own Zernio account (its own bill) or on Zenno's. */
export default function OwnZernioModal({ ownZernio, hasActiveAccounts, onClose, onChanged }: OwnZernioModalProps) {
  const { t } = useAdminText(OWN_ZERNIO_TEXT);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<{ ownZernio: boolean; accounts: SocialAccount[] }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      onChanged(result.ownZernio, result.accounts);
      onClose();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
      setBusy(false);
    }
  };

  const disconnect = () => {
    if (confirm(t.confirmDisconnect)) run(disconnectOwnZernio);
  };

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="own-zernio-title">
      <div className={`${ADMIN_MODAL} max-w-lg p-6`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="own-zernio-title" className="text-lg font-semibold text-[#1A1714]">{t.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className={ADMIN_TERTIARY_BUTTON}><X className="h-4 w-4" /></button>
        </div>
        <div className="rounded-xl bg-stone-50 px-4 py-3">
          <p className="text-sm font-medium text-[#1A1714]">{ownZernio ? t.usingOwn : t.usingZenno}</p>
          <p className="mt-1 text-xs text-stone-500">{ownZernio ? t.usingOwnHint : t.usingZennoHint}</p>
        </div>
        {hasActiveAccounts && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{t.needsEmpty}</p>}
        {!ownZernio && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-stone-700">{t.apiKey}</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={busy || hasActiveAccounts}
              className={ADMIN_INPUT}
            />
            <span className="mt-1 block text-xs text-stone-500">{t.apiKeyHint}</span>
          </label>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.close}</button>
          {ownZernio ? (
            <button type="button" onClick={disconnect} disabled={busy || hasActiveAccounts} className={ADMIN_PRIMARY_BUTTON}>
              {busy ? t.disconnecting : t.disconnect}
            </button>
          ) : (
            <button type="button" onClick={() => run(() => connectOwnZernio(apiKey))} disabled={busy || hasActiveAccounts || !apiKey.trim()} className={ADMIN_PRIMARY_BUTTON}>
              {busy ? t.connecting : t.connect}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
