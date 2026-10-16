import { useCallback, useEffect, useState } from 'react';
import { MessagesSquare, PenSquare } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import { loadConversations, loadDraftConversationIds, type InboxFilter, type Overview } from './receptionistApi';
import { RECEPTIONIST_TEXT } from './receptionistText';
import ConversationList, { type ListConversation } from './inbox/ConversationList';
import ThreadPane from './inbox/ThreadPane';
import NewChatModal from './inbox/NewChatModal';

const LIST_REFRESH_MS = 8_000;

interface InboxPanelProps {
  overview: Overview;
  onChanged: () => void;
}

/** Messenger: all chats on the left, the open chat on the right (one at a time on phones). */
export default function InboxPanel({ overview, onChanged }: InboxPanelProps) {
  const { t, locale } = useAdminText(RECEPTIONIST_TEXT);
  const businessId = overview.settings.business_id;
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ListConversation[]>([]);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [hasError, setHasError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [conversations, drafts] = await Promise.all([loadConversations(businessId, filter), loadDraftConversationIds(businessId)]);
      setRows(conversations);
      setDraftIds(drafts);
      setHasError(false);
    } catch (error) {
      console.error('Could not load the inbox:', error);
      setHasError(true);
    }
  }, [businessId, filter]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, LIST_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = rows.find((c) => c.id === selectedId) ?? null;
  const refresh = () => { load(); onChanged(); };

  return (
    <div>
      <div className={`${ADMIN_SURFACE} grid h-[calc(100vh-190px)] min-h-[480px] overflow-hidden lg:grid-cols-[320px_1fr]`}>
        <div className={`border-r border-stone-200/70 ${selected ? 'hidden lg:block' : 'block'} min-h-0`}>
          {hasError
            ? <p className="p-6 text-sm text-red-700">{t.loadFailed}</p>
            : <ConversationList rows={rows} selectedId={selectedId} filter={filter} query={query} draftIds={draftIds} locale={locale} t={t}
                onFilter={setFilter} onQuery={setQuery} onSelect={setSelectedId} onNewChat={() => setIsComposing(true)} />}
        </div>
        <div className={`${selected ? 'block' : 'hidden lg:flex'} min-h-0 lg:flex lg:flex-col`}>
          {selected
            ? <ThreadPane key={selected.id} conversation={selected} onBack={() => setSelectedId(null)} onChanged={refresh} />
            : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-stone-900/[0.015] p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-stone-400 shadow-sm ring-1 ring-stone-900/[0.05]"><MessagesSquare className="h-6 w-6" /></span>
                <p className="text-sm text-stone-500">{t.pickChat}</p>
                <button type="button" onClick={() => setIsComposing(true)} className={ADMIN_SECONDARY_BUTTON}><PenSquare className="h-4 w-4" />{t.newChat}</button>
              </div>
            )}
        </div>
      </div>

      {isComposing && (
        <NewChatModal
          businessId={businessId}
          canWhatsapp={overview.settings.whatsapp_status === 'connected' && overview.settings.whatsapp_provider === 'qr_gateway'}
          canEmail={Boolean(overview.status.mailbox)}
          t={t}
          onClose={() => setIsComposing(false)}
          onStarted={(id) => { setIsComposing(false); setFilter('all'); setSelectedId(id); refresh(); }}
        />
      )}
    </div>
  );
}
