import { PenSquare, Search } from 'lucide-react';
import { ADMIN_INPUT } from '../../adminUi';
import type { ChannelKey, Conversation, InboxFilter } from '../receptionistApi';
import { CHANNEL_ICON, contactLabel } from '../receptionistFormat';
import type { ReceptionistText } from '../receptionistText';

export type ListConversation = Conversation & { preview: string | null };

const CHANNEL_TINT: Record<ChannelKey, string> = {
  whatsapp: 'bg-emerald-500 text-white',
  email: 'bg-sky-500 text-white',
  web: 'bg-stone-700 text-white',
};

interface ConversationListProps {
  rows: ListConversation[];
  selectedId: string | null;
  filter: InboxFilter;
  query: string;
  draftIds: Set<string>;
  locale: string;
  t: ReceptionistText;
  onFilter: (filter: InboxFilter) => void;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

function timeLabel(iso: string, locale: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Left pane: every chat from every channel, newest first. */
export default function ConversationList(props: ConversationListProps) {
  const { t, filter } = props;
  const textFilters: { id: InboxFilter; label: string }[] = [{ id: 'all', label: t.filterAll }, { id: 'needs_human', label: t.filterNeedsHuman }];
  const channelFilters: { id: ChannelKey; label: string }[] = [
    { id: 'whatsapp', label: t.channelWhatsapp }, { id: 'email', label: t.channelEmail }, { id: 'web', label: t.channelWeb },
  ];
  const chip = (isActive: boolean) => `inline-flex h-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition ${isActive ? 'bg-[#1A1714] text-white' : 'text-stone-500 hover:bg-stone-900/[0.06] hover:text-[#1A1714]'}`;
  const needle = props.query.trim().toLowerCase();
  const rows = needle
    ? props.rows.filter((c) => [c.contact_name, c.contact_email, c.contact_phone, c.subject, c.preview].some((v) => v?.toLowerCase().includes(needle)))
    : props.rows;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-stone-200/70 p-2.5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input value={props.query} onChange={(e) => props.onQuery(e.target.value)} placeholder={t.searchChats} className={`${ADMIN_INPUT} rounded-lg py-1.5 pl-9`} />
          </div>
          <button type="button" onClick={props.onNewChat} title={t.newChat} aria-label={t.newChat}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1A1714] text-white transition hover:bg-[#2E2926] active:translate-y-px">
            <PenSquare className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          {textFilters.map((f) => (
            <button key={f.id} type="button" onClick={() => props.onFilter(f.id)} className={`${chip(filter === f.id)} px-2.5`}>{f.label}</button>
          ))}
          <span className="mx-1 h-4 w-px bg-stone-200" />
          {channelFilters.map((f) => {
            const Icon = CHANNEL_ICON[f.id];
            return (
              <button key={f.id} type="button" onClick={() => props.onFilter(f.id)} title={f.label} aria-label={f.label} className={`${chip(filter === f.id)} w-7`}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {rows.length === 0 && <li className="p-8 text-center text-sm text-stone-500">{props.query ? t.noMatches : t.emptyInbox}</li>}
        {rows.map((c) => {
          const Icon = CHANNEL_ICON[c.channel];
          const label = contactLabel(c, t);
          const isSelected = c.id === props.selectedId;
          const needsYou = c.status === 'needs_human' || props.draftIds.has(c.id);
          return (
            <li key={c.id}>
              <button type="button" onClick={() => props.onSelect(c.id)}
                className={`relative flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${isSelected ? 'bg-stone-900/[0.06] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[#1A1714]' : 'hover:bg-stone-900/[0.03]'}`}>
                <span className="relative shrink-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200 text-sm font-semibold uppercase text-stone-700">{label.slice(0, 1)}</span>
                  <span className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${CHANNEL_TINT[c.channel]}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate text-sm text-[#1A1714] ${c.unread_count > 0 ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-stone-400">{timeLabel(c.last_message_at, props.locale)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={`truncate text-[13px] ${c.unread_count > 0 ? 'text-stone-800' : 'text-stone-500'}`}>{c.preview ?? c.subject ?? ''}</span>
                    {needsYou && <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{t.stateNeedsHuman}</span>}
                    {!needsYou && c.unread_count > 0 && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-label={t.stateUnread} />}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
