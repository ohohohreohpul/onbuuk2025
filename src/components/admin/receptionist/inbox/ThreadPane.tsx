import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Bot, CalendarCheck, CheckCheck, Loader2, Phone, Send } from 'lucide-react';
import { useAdminText } from '../../../../lib/adminLanguage';
import { fillText } from '../../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../../adminUi';
import { Switch } from '../ChannelsPanel';
import { callReceptionist, loadMessages, type ChannelKey, type Conversation, type Message } from '../receptionistApi';
import { contactLabel } from '../receptionistFormat';
import { RECEPTIONIST_TEXT, type ReceptionistText } from '../receptionistText';

const THREAD_REFRESH_MS = 4_000;

function actionLabel(tool: string, t: ReceptionistText): string | null {
  if (tool === 'book_appointment') return t.booked;
  if (tool === 'cancel_booking') return t.cancelledAction;
  if (tool === 'move_booking') return t.movedAction;
  return null;
}

function DraftActions({ message, t, isBusy, onSend, onDiscard }: {
  message: Message; t: ReceptionistText; isBusy: boolean; onSend: (text: string) => void; onDiscard: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(message.body);
  return (
    <div className="mt-2 space-y-2">
      {isEditing && <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={ADMIN_INPUT} />}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isBusy} onClick={() => onSend(isEditing ? text : message.body)} className={`${ADMIN_PRIMARY_BUTTON} py-1.5`}>
          <Send className="h-4 w-4" />{t.sendDraft}
        </button>
        {!isEditing && <button type="button" onClick={() => setIsEditing(true)} className={`${ADMIN_SECONDARY_BUTTON} py-1.5`}>{t.editDraft}</button>}
        <button type="button" disabled={isBusy} onClick={onDiscard} className={`${ADMIN_TERTIARY_BUTTON} text-red-700`}>{t.discard}</button>
      </div>
    </div>
  );
}

interface ThreadPaneProps {
  conversation: Conversation;
  onBack: () => void;
  onChanged: () => void;
}

/** Right pane: the chat itself, like a messenger, replying on the conversation's own channel. */
export default function ThreadPane({ conversation, onBack, onChanged }: ThreadPaneProps) {
  const { t, locale } = useAdminText(RECEPTIONIST_TEXT);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const channelName: Record<ChannelKey, string> = { web: t.channelWeb, email: t.channelEmail, whatsapp: t.channelWhatsapp };

  const load = useCallback(async () => {
    try {
      setMessages(await loadMessages(conversation.id));
    } catch (loadError) {
      console.error('Could not load messages:', loadError);
      setError(t.loadFailed);
    }
  }, [conversation.id, t.loadFailed]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, THREAD_REFRESH_MS);
    if (conversation.unread_count > 0) callReceptionist('set_conversation', { conversationId: conversation.id, markRead: true }).then(onChanged).catch(() => undefined);
    return () => window.clearInterval(timer);
    // once per opened conversation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const run = async (action: string, payload: Record<string, unknown>, after?: () => void) => {
    setIsBusy(true);
    setError(null);
    try {
      await callReceptionist(action, { conversationId: conversation.id, ...payload });
      after?.();
      await load();
      onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t.saveFailed);
    } finally {
      setIsBusy(false);
    }
  };

  const send = () => { if (reply.trim() && !isBusy) run('reply', { text: reply }, () => setReply('')); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
  };
  const isAiOn = !conversation.is_ai_paused && conversation.status !== 'needs_human';
  const details = [conversation.contact_phone, conversation.contact_email].filter(Boolean).join(' · ');
  let lastDay = '';

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-stone-200/70 px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t.back} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#1A1714]">{contactLabel(conversation, t)}</p>
          <p className="truncate text-xs text-stone-500">{fillText(t.via, { channel: channelName[conversation.channel] })}{details ? ` · ${details}` : ''}</p>
        </div>
        {conversation.contact_phone && (
          <a href={`tel:${conversation.contact_phone.replace(/[^\d+]/g, '')}`} aria-label={conversation.contact_phone} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><Phone className="h-4 w-4" /></a>
        )}
        <label className="hidden items-center gap-2 text-xs font-medium text-stone-600 sm:flex">
          {isAiOn ? t.aiOnHere : t.aiOffHere}
          <Switch isOn={isAiOn} label={t.aiOnHere} isDisabled={isBusy}
            onChange={(on) => run('set_conversation', on ? { resolve: true } : { isAiPaused: true })} />
        </label>
        <button type="button" disabled={isBusy} onClick={() => run('set_conversation', { close: true })} title={t.closeConversation} aria-label={t.closeConversation}
          className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><CheckCheck className="h-4 w-4" /></button>
      </header>

      {conversation.status === 'needs_human' && (
        <p className="flex items-start gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{fillText(t.handedOver, { reason: conversation.needs_human_reason ?? '' })}
        </p>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto bg-[#F7F5F2] px-4 py-4">
        {messages.map((m) => {
          const day = new Date(m.created_at).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
          const separator = day !== lastDay ? <p className="py-2 text-center text-xs font-medium text-stone-400">{day}</p> : null;
          lastDay = day;
          if (m.author === 'system') return <div key={m.id}>{separator}<p className="text-center text-xs text-stone-500">{m.body}</p></div>;
          const isCustomer = m.direction === 'in';
          const actions = (m.meta.actions ?? []).map((a) => actionLabel(a.tool, t)).filter(Boolean);
          const bubble = isCustomer ? 'bg-white text-[#1A1714] rounded-bl-md'
            : m.status === 'draft' ? 'border-2 border-dashed border-amber-300 bg-amber-50 text-[#1A1714] rounded-br-md'
            : m.author === 'ai' ? 'bg-[#2B2622] text-white rounded-br-md' : 'bg-emerald-700 text-white rounded-br-md';
          return (
            <div key={m.id}>
              {separator}
              <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${bubble}`}>
                  {!isCustomer && m.status !== 'draft' && (
                    <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold opacity-60">{m.author === 'ai' ? <><Bot className="h-3 w-3" />{t.ai}</> : t.team}</p>
                  )}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {actions.map((label) => <p key={label} className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"><CalendarCheck className="h-3 w-3" />{label}</p>)}
                  <p className={`mt-0.5 text-right text-[10px] ${isCustomer || m.status === 'draft' ? 'text-stone-400' : 'text-white/50'}`}>
                    {new Date(m.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    {m.status === 'failed' && ` · ${t.failedLabel}`}
                  </p>
                  {m.status === 'draft' && (
                    <>
                      <p className="text-xs font-medium text-amber-800">{t.draftLabel}</p>
                      <DraftActions message={m} t={t} isBusy={isBusy}
                        onSend={(text) => run('send_draft', { messageId: m.id, text })}
                        onDiscard={() => run('discard_draft', { messageId: m.id })} />
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <div className="border-t border-stone-200/70 bg-white/80 p-3">
        <div className="flex items-end gap-2">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={onKeyDown} rows={1} maxLength={4000}
            placeholder={t.typeMessage} className={`${ADMIN_INPUT} max-h-40 min-h-[44px] resize-none`} />
          <button type="button" onClick={send} disabled={isBusy || !reply.trim()} aria-label={t.send} className={`${ADMIN_PRIMARY_BUTTON} h-11 w-11 shrink-0 p-0`}>
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-stone-400">{t.enterHint} · {t.replyHint}</p>
      </div>
    </div>
  );
}
