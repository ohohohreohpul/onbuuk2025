import { useState, type FormEvent } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../adminUi';
import CalendarModal from '../calendar/CalendarModal';
import { suggestStyle, type Briefing } from './receptionistApi';
import type { BRIEFING_TEXT } from './briefingText';

interface LearnFromWebsiteModalProps {
  language: string;
  t: (typeof BRIEFING_TEXT)['en'];
  onClose: () => void;
  onSuggestion: (suggestion: Omit<Briefing, 'habits'>) => void;
}

/** Asks for the shop's website and returns a personality suggestion (nothing is saved here). */
export default function LearnFromWebsiteModal({ language, t, onClose, onSuggestion }: LearnFromWebsiteModalProps) {
  const [url, setUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim() || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const { suggestion } = await suggestStyle(url.trim(), language);
      onSuggestion(suggestion);
    } catch (learnError) {
      setError(learnError instanceof Error ? learnError.message : t.saveFailed);
      setIsBusy(false);
    }
  };

  return (
    <CalendarModal title={t.learnTitle} closeLabel={t.close} onClose={isBusy ? () => {} : onClose} maxWidthClass="max-w-md">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-stone-500">{t.learnHint}</p>
        <label className="block text-sm font-medium text-stone-700">{t.learnUrl}
          <span className="relative mt-1 block">
            <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="www.my-spa.de" inputMode="url" autoFocus
              disabled={isBusy} className={`${ADMIN_INPUT} pl-9`} />
          </span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isBusy} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
          <button type="submit" disabled={isBusy || !url.trim()} className={ADMIN_PRIMARY_BUTTON}>
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}{isBusy ? t.learnBusy : t.learnGo}
          </button>
        </div>
      </form>
    </CalendarModal>
  );
}
