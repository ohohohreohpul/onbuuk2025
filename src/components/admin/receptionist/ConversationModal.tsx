import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, CalendarCheck, CheckCheck, Loader2, Pause, Phone, Play, Send } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import CalendarModal from '../calendar/CalendarModal';
import { callReceptionist, loadMessages, type Conversation, type Message } from './receptionistApi';
import { RECEPTIONIST_TEXT, type ReceptionistText } from './receptionistText';
import { contactLabel } from './receptionistFormat';

interface ConversationModalProps {
  conversation: Conversation;
  onClose: () => void;
  onChanged: () => void;
}

function actionLabel(tool: string, t: ReceptionistText): string | null {
  if (tool === 'book_appointment') return t.booked;
  if (tool === 'cancel_booking') return t.cancelledAction;
  if (tool === 'move_booking') return t.movedAction;
  return null;
}

function DraftActions({ message, t, onSend, onDiscard, isBusy }: {
  message: Message; t: ReceptionistText; isBusy: boolean; onSend: (text: string) => void; onDiscard: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(message.body);
  return (
    <div className="mt-2 space-y-2">
      {isEditing && <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={ADMIN_INPUT} />}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isBusy} onClick={() => onSend(isEditing ? text : message.body)} className={`${ADMIN_PRIMARY_BUTTON} py-2`}>
          <Send className="h-4 w-4" />{t.sendDraft}
        </button>
        {!isEditing && <button type="button" onClick={() => setIsEditing(true)} className={`${ADMIN_SECONDARY_BUTTON} py-2`}>{t.editDraft}</button>}
        <button type="button" disabled={isBusy} onClick={onDiscard} className={`${ADMIN_TERTIARY_BUTTON} text-red-700`}>{t.discard}</button>
      </div>
    </div>
  );
}

/** One conversation: the thread, drafts to approve, a reply box and the AI on/off for this person. */
export default function ConversationModal({ conversation, onClose, onChanged }: ConversationModalProps) {
  const { t, locale } = useAdminText(RECEPTIONIST_TEXT);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(conversation.is_ai_paused);
  const endRef = useRef<HTMLDivElement>(null);

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
    if (conversation.unread_count > 0) callReceptionist('set_conversation', { conversationId: conversation.id, markRead: true }).then(onChanged).catch(() => undefined);
    // mark read once per opening
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

  const author = (m: Message) => (m.author === 'customer' ? t.customer : m.author === 'staff' ? t.team : t.ai);
  const details = [conversation.contact_email, conversation.contact_phone].filter(Boolean).join(' · ');

  return (
    <CalendarModal title={contactLabel(conversation, t)} subtitle={details || undefined} closeLabel={t.close} onClose={onClose} maxWidthClass="max-w-2xl">
      <div className="space-y-4">
        {conversation.contact_phone && (
          <a href={`tel:${conversation.contact_phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1A1714] hover:underline">
            <Phone className="h-4 w-4" />{conversation.contact_phone}
          </a>
        )}
        {conversation.status === 'needs_human' && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{fillText(t.handedOver, { reason: conversation.needs_human_reason ?? '' })}
          </p>
        )}

        <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-2xl bg-[#F7F5F2] p-4">
          {messages.map((m) => {
            if (m.author === 'system') return <p key={m.id} className="text-center text-xs text-stone-500">{m.body}</p>;
            const isCustomer = m.direction === 'in';
            const actions = (m.meta.actions ?? []).map((a) => actionLabel(a.tool, t)).filter(Boolean);
            return (
              <div key={m.id} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isCustomer ? 'bg-white text-[#1A1714]' : m.status === 'draft' ? 'border-2 border-dashed border-amber-300 bg-amber-50 text-[#1A1714]' : 'bg-[#1A1714] text-white'}`}>
                  <p className={`mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${isCustomer || m.status === 'draft' ? 'text-stone-400' : 'text-white/60'}`}>
                    {m.author === 'ai' && <Bot className="h-3 w-3" />}{author(m)} · {new Date(m.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {actions.map((label) => <p key={label} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"><CalendarCheck className="h-3 w-3" />{label}</p>)}
                  {m.status === 'failed' && <p className="mt-1 text-xs font-medium text-red-300">{t.failedLabel}</p>}
                  {m.status === 'draft' && (
                    <>
                      <p className="mt-1 text-xs font-medium text-amber-800">{t.draftLabel}</p>
                      <DraftActions message={m} t={t} isBusy={isBusy}
                        onSend={(text) => run('send_draft', { messageId: m.id, text })}
                        onDiscard={() => run('discard_draft', { messageId: m.id })} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="space-y-2">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={4000} placeholder={t.replyPlaceholder} className={ADMIN_INPUT} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-stone-400">{t.replyHint}</span>
            <button type="button" disabled={isBusy || !reply.trim()} onClick={() => run('reply', { text: reply }, () => { setReply(''); setIsPaused(true); })} className={ADMIN_PRIMARY_BUTTON}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isBusy ? t.sending : t.send}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-stone-200/70 pt-4">
          {isPaused || conversation.status === 'needs_human' ? (
            <button type="button" disabled={isBusy} onClick={() => run('set_conversation', { resolve: true }, () => setIsPaused(false))} className={ADMIN_SECONDARY_BUTTON}>
              <Play className="h-4 w-4" />{t.resumeAi}
            </button>
          ) : (
            <button type="button" disabled={isBusy} onClick={() => run('set_conversation', { isAiPaused: true }, () => setIsPaused(true))} className={ADMIN_SECONDARY_BUTTON}>
              <Pause className="h-4 w-4" />{t.pauseAi}
            </button>
          )}
          <button type="button" disabled={isBusy} onClick={() => run('set_conversation', { close: true }, onClose)} className={ADMIN_SECONDARY_BUTTON}>
            <CheckCheck className="h-4 w-4" />{t.closeConversation}
          </button>
        </div>
        {isPaused && <p className="text-xs text-stone-500">{t.aiPausedNote}</p>}
      </div>
    </CalendarModal>
  );
}
