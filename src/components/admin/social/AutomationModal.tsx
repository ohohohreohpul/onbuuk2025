import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import {
  ADMIN_INPUT, ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT, ADMIN_TERTIARY_BUTTON,
} from '../adminUi';
import { SOCIAL_TEXT } from './socialText';
import { parseKeywords, saveAutomation, deleteAutomation, type Automation, type AutomationDraft, type SocialAccount } from './socialApi';

interface AutomationModalProps {
  automation: Automation | null;
  accounts: SocialAccount[];
  bookingUrl: string;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_BUTTON_TITLE = 20;

/** "Bearbeiten" popup for one comment-to-DM automation. */
export default function AutomationModal({ automation, accounts, bookingUrl, canEdit, onClose, onSaved }: AutomationModalProps) {
  const { t } = useAdminText(SOCIAL_TEXT);
  const [draft, setDraft] = useState<AutomationDraft>(() => automation ?? {
    name: t.defaultName,
    accountId: accounts[0]?.id ?? '',
    keywords: parseKeywords(t.defaultKeywords),
    dmMessage: t.defaultDm,
    buttonTitle: t.defaultButton,
    buttonUrl: bookingUrl,
    commentReply: t.defaultReply,
    isActive: true,
  });
  const [keywordText, setKeywordText] = useState(draft.keywords.join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (patch: Partial<AutomationDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
      setBusy(false);
    }
  };

  const save = () => run(() => saveAutomation(automation?.id ?? null, { ...draft, keywords: parseKeywords(keywordText) }));
  const remove = () => {
    if (automation && confirm(t.confirmDelete)) run(() => deleteAutomation(automation.id));
  };

  const label = (text: string, hint?: string) => (
    <span className="mb-1.5 block text-sm font-medium text-stone-700">{text}{hint && <span className="ml-1 font-normal text-stone-400">· {hint}</span>}</span>
  );

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="automation-title">
      <div className={`${ADMIN_MODAL} max-h-[90vh] max-w-xl overflow-y-auto p-6`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="automation-title" className="text-lg font-semibold text-[#1A1714]">{automation ? t.edit : t.newAutomation}</h2>
          <button type="button" onClick={onClose} aria-label={t.cancel} className={ADMIN_TERTIARY_BUTTON}><X className="h-4 w-4" /></button>
        </div>
        <fieldset disabled={!canEdit || busy} className="space-y-4">
          <label className="block">{label(t.name)}
            <input value={draft.name} onChange={(e) => update({ name: e.target.value })} maxLength={80} placeholder={t.namePlaceholder} className={ADMIN_INPUT} />
          </label>
          <label className="block">{label(t.account)}
            <select value={draft.accountId} onChange={(e) => update({ accountId: e.target.value })} className={ADMIN_SELECT} disabled={Boolean(automation)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.platform === 'instagram' ? 'Instagram' : 'Facebook'} · {account.username ?? account.displayName}</option>
              ))}
            </select>
          </label>
          <label className="block">{label(t.keywords, t.keywordsHint)}
            <input value={keywordText} onChange={(e) => setKeywordText(e.target.value)} className={ADMIN_INPUT} />
          </label>
          <label className="block">{label(t.dmMessage)}
            <textarea value={draft.dmMessage} onChange={(e) => update({ dmMessage: e.target.value })} rows={4} maxLength={1000} placeholder={t.dmPlaceholder} className={`${ADMIN_INPUT} resize-none`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className="block">{label(t.buttonTitle)}
              <input value={draft.buttonTitle} onChange={(e) => update({ buttonTitle: e.target.value })} maxLength={MAX_BUTTON_TITLE} className={ADMIN_INPUT} />
            </label>
            <label className="block">{label(t.buttonUrl, t.buttonHint)}
              <input type="url" value={draft.buttonUrl} onChange={(e) => update({ buttonUrl: e.target.value })} placeholder="https://" className={ADMIN_INPUT} />
            </label>
          </div>
          <label className="block">{label(t.commentReply, t.commentReplyHint)}
            <input value={draft.commentReply} onChange={(e) => update({ commentReply: e.target.value })} maxLength={300} className={ADMIN_INPUT} />
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => update({ isActive: e.target.checked })} className="h-4 w-4 accent-[#1A1714]" />
            <span className="text-sm font-medium text-[#1A1714]">{t.active}</span>
          </label>
        </fieldset>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex items-center justify-between gap-3">
          {automation && canEdit
            ? <button type="button" onClick={remove} disabled={busy} className={`${ADMIN_TERTIARY_BUTTON} text-red-700 hover:bg-red-50`}><Trash2 className="h-4 w-4" /> {t.delete}</button>
            : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
            {canEdit && <button type="button" onClick={save} disabled={busy} className={ADMIN_PRIMARY_BUTTON}>{busy ? t.saving : t.save}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
