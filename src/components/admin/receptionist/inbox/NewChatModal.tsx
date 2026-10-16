import { useEffect, useState } from 'react';
import { Loader2, Mail, MessageCircle, Send } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../../adminUi';
import CalendarModal from '../../calendar/CalendarModal';
import { callReceptionist } from '../receptionistApi';
import type { ReceptionistText } from '../receptionistText';

const SEARCH_DELAY_MS = 250;
const MAX_RESULTS = 6;

type NewChatChannel = 'whatsapp' | 'email';
interface CustomerHit { id: string; name: string; email: string; phone: string | null }

interface NewChatModalProps {
  businessId: string;
  canWhatsapp: boolean;
  canEmail: boolean;
  t: ReceptionistText;
  onClose: () => void;
  onStarted: (conversationId: string) => void;
}

/** Start a chat on WhatsApp or email with a customer (search) or any number/address. */
export default function NewChatModal({ businessId, canWhatsapp, canEmail, t, onClose, onStarted }: NewChatModalProps) {
  const [channel, setChannel] = useState<NewChatChannel>(canWhatsapp ? 'whatsapp' : 'email');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.replace(/[,()%*\\"_]/g, ' ').trim();
    if (term.length < 2) { setHits([]); return; }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.from('customers').select('id, name, email, phone').eq('business_id', businessId)
        .or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).limit(MAX_RESULTS);
      setHits((data ?? []) as CustomerHit[]);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, businessId]);

  const pick = (hit: CustomerHit) => {
    setName(hit.name);
    setTo(channel === 'email' ? hit.email : hit.phone ?? '');
    setQuery('');
    setHits([]);
  };

  const send = async () => {
    setIsSending(true);
    setError(null);
    try {
      const result = await callReceptionist<{ conversationId: string }>('start_conversation', { channel, to, name, subject, text });
      onStarted(result.conversationId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t.startFailed);
    } finally {
      setIsSending(false);
    }
  };

  const tab = (isActive: boolean) => `flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition disabled:opacity-40 ${isActive ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'}`;

  return (
    <CalendarModal title={t.newChat} closeLabel={t.close} onClose={onClose} maxWidthClass="max-w-lg">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button type="button" disabled={!canWhatsapp} onClick={() => { setChannel('whatsapp'); setTo(''); }} className={tab(channel === 'whatsapp')}><MessageCircle className="h-4 w-4" />{t.channelWhatsapp}</button>
          <button type="button" disabled={!canEmail} onClick={() => { setChannel('email'); setTo(''); }} className={tab(channel === 'email')}><Mail className="h-4 w-4" />{t.channelEmail}</button>
        </div>

        <div className="relative">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.pickCustomer} className={ADMIN_INPUT} />
          {hits.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button type="button" onClick={() => pick(hit)} className="w-full px-4 py-2.5 text-left hover:bg-stone-50">
                    <span className="block text-sm font-medium text-[#1A1714]">{hit.name}</span>
                    <span className="block text-xs text-stone-500">{channel === 'email' ? hit.email : hit.phone ?? '–'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-stone-400">{t.orType}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={channel === 'email' ? t.toEmail : t.toPhone}
            type={channel === 'email' ? 'email' : 'tel'} className={ADMIN_INPUT} aria-label={t.to} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.contactName} maxLength={120} className={ADMIN_INPUT} />
        </div>
        {channel === 'email' && <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.subject} maxLength={200} className={ADMIN_INPUT} />}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} placeholder={t.typeMessage} className={ADMIN_INPUT} />

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
          <button type="button" onClick={send} disabled={isSending || !to.trim() || !text.trim() || (channel === 'email' && !subject.trim())} className={ADMIN_PRIMARY_BUTTON}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t.send}
          </button>
        </div>
      </div>
    </CalendarModal>
  );
}
