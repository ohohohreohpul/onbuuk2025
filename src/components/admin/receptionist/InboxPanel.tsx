import { useCallback, useEffect, useState } from 'react';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SEGMENTED_CONTROL, ADMIN_SEGMENT_ACTIVE, ADMIN_SEGMENT_INACTIVE, ADMIN_STATUS_PILL, ADMIN_SURFACE } from '../adminUi';
import { loadConversations, loadDraftConversationIds, type ChannelKey, type Conversation } from './receptionistApi';
import { RECEPTIONIST_TEXT, type ReceptionistText } from './receptionistText';
import ConversationModal from './ConversationModal';
import { CHANNEL_ICON, contactLabel } from './receptionistFormat';

const REFRESH_MS = 30_000;
type Filter = 'all' | 'needs_human' | 'unread';

/** One plain-language state per conversation, most urgent first. */
function stateOf(c: Conversation, hasDraft: boolean, t: ReceptionistText): { label: string; tone: string } {
  if (c.status === 'needs_human') return { label: t.stateNeedsHuman, tone: 'bg-amber-100 text-amber-900' };
  if (hasDraft) return { label: t.stateDraft, tone: 'bg-amber-50 text-amber-800' };
  if (c.unread_count > 0 && c.is_ai_paused) return { label: t.stateUnread, tone: 'bg-sky-100 text-sky-900' };
  if (c.status === 'closed') return { label: t.stateClosed, tone: 'bg-stone-100 text-stone-500' };
  if (c.is_ai_paused) return { label: t.stateAiPaused, tone: 'bg-stone-100 text-stone-700' };
  return { label: t.stateAnswered, tone: 'bg-emerald-50 text-emerald-800' };
}

export default function InboxPanel({ businessId, onChanged }: { businessId: string; onChanged: () => void }) {
  const { t, locale } = useAdminText(RECEPTIONIST_TEXT);
  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<Conversation[]>([]);
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  const [hasError, setHasError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [conversations, draftIds] = await Promise.all([loadConversations(businessId, filter), loadDraftConversationIds(businessId)]);
      setRows(conversations);
      setDrafts(draftIds);
      setHasError(false);
    } catch (error) {
      console.error('Could not load the inbox:', error);
      setHasError(true);
    }
  }, [businessId, filter]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t.filterAll }, { id: 'needs_human', label: t.filterNeedsHuman }, { id: 'unread', label: t.filterUnread },
  ];
  const channelName: Record<ChannelKey, string> = { web: t.channelWeb, email: t.channelEmail, whatsapp: t.channelWhatsapp };
  const opened = rows.find((c) => c.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className={ADMIN_SEGMENTED_CONTROL} role="tablist">
        {filters.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === f.id ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className={`${ADMIN_SURFACE} divide-y divide-stone-100 overflow-hidden`}>
        {hasError && <p className="p-6 text-sm text-red-700">{t.loadFailed}</p>}
        {!hasError && rows.length === 0 && <p className="p-10 text-center text-sm text-stone-500">{t.emptyInbox}</p>}
        {rows.map((c) => {
          const Icon = CHANNEL_ICON[c.channel];
          const state = stateOf(c, drafts.has(c.id), t);
          return (
            <div key={c.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.05] text-stone-600" title={channelName[c.channel]}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[15px] text-[#1A1714] ${c.unread_count > 0 ? 'font-semibold' : 'font-medium'}`}>{contactLabel(c, t)}</p>
                <p className="truncate text-sm text-stone-500">
                  {channelName[c.channel]} · {new Date(c.last_message_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {c.subject ? ` · ${c.subject}` : ''}
                </p>
              </div>
              <span className={`${ADMIN_STATUS_PILL} hidden sm:inline-flex ${state.tone}`}>{state.label}</span>
              <button type="button" onClick={() => setOpenId(c.id)} className={ADMIN_SECONDARY_BUTTON}>{t.open}</button>
            </div>
          );
        })}
      </div>

      {opened && (
        <ConversationModal
          conversation={opened}
          onClose={() => setOpenId(null)}
          onChanged={() => { load(); onChanged(); }}
        />
      )}
    </div>
  );
}
