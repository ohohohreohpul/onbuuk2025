import { useEffect, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ADMIN_INPUT } from '../adminUi';
import type { CreateBookingText } from './createBookingText';

const SEARCH_DELAY_MS = 250;
const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;

export interface PickedCustomer {
  id: string | null;
  name: string;
  email: string;
  phone: string;
}

interface CustomerPickerProps {
  businessId: string;
  value: PickedCustomer | null;
  initialQuery?: string;
  isNew: boolean;
  t: CreateBookingText;
  onPick: (customer: PickedCustomer | null) => void;
  onNew: (isNew: boolean) => void;
}

/** Characters that would break a PostgREST or() filter or act as wildcards. */
const cleanQuery = (query: string) => query.replace(/[,()%*\\"_]/g, ' ').trim();

const PHONE_QUERY = /^[\d+\s/-]+$/;
const isPhoneQuery = (query: string) => PHONE_QUERY.test(query.trim());

/** "0157 7180 7377" -> "0%1%5%7…" so stored numbers match with or without spaces. */
const phonePattern = (query: string) => query.replace(/\D/g, '').split('').join('%');

/** Search existing customers as you type, or enter a new one. */
export default function CustomerPicker({ businessId, value, initialQuery, isNew, t, onPick, onNew }: CustomerPickerProps) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const term = cleanQuery(query);
    if (term.length < MIN_QUERY_LENGTH) { setResults([]); return; }
    let isCancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('business_id', businessId)
        .or(isPhoneQuery(term)
          ? `phone.ilike.%${phonePattern(term)}%`
          : `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
        .order('name')
        .limit(MAX_RESULTS);
      if (isCancelled) return;
      if (error) console.error('Customer search failed:', error);
      setResults(((data ?? []) as PickedCustomer[]).map((c) => ({ ...c, phone: c.phone ?? '' })));
      setIsSearching(false);
    }, SEARCH_DELAY_MS);
    return () => { isCancelled = true; window.clearTimeout(timer); };
  }, [query, businessId]);

  if (value && !isNew) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#1A1714]">{value.name}</p>
          <p className="truncate text-sm text-stone-500">{[value.phone, value.email].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" onClick={() => onPick(null)} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">{t.change}</button>
      </div>
    );
  }

  if (isNew) {
    const draft = value ?? { id: null, name: '', email: '', phone: '' };
    const set = (field: keyof PickedCustomer, text: string) => onPick({ ...draft, id: null, [field]: text });
    return (
      <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <label className="block text-sm text-stone-600">{t.name}
          <input value={draft.name} onChange={(e) => set('name', e.target.value)} className={`${ADMIN_INPUT} mt-1`} autoComplete="off" />
        </label>
        <label className="block text-sm text-stone-600">{t.phone}
          <input type="tel" value={draft.phone} onChange={(e) => set('phone', e.target.value)} className={`${ADMIN_INPUT} mt-1`} autoComplete="off" />
        </label>
        <label className="block text-sm text-stone-600">{t.email}
          <input type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} className={`${ADMIN_INPUT} mt-1`} autoComplete="off" />
          <span className="mt-1 block text-xs text-stone-400">{t.emailHint}</span>
        </label>
        <button type="button" onClick={() => { onNew(false); onPick(null); }} className="text-sm font-medium text-stone-600 underline">{t.cancel}</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchCustomer} className={`${ADMIN_INPUT} pl-10`} autoComplete="off" />
      </div>
      {isSearching && <p className="text-sm text-stone-400">{t.searching}</p>}
      {!isSearching && cleanQuery(query).length >= MIN_QUERY_LENGTH && results.length === 0 && <p className="text-sm text-stone-500">{t.noMatch}</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {results.map((customer) => (
            <li key={customer.id}>
              <button type="button" onClick={() => onPick(customer)} className="w-full px-4 py-3 text-left hover:bg-stone-50">
                <span className="block font-medium text-[#1A1714]">{customer.name}</span>
                <span className="block text-sm text-stone-500">{[customer.phone, customer.email].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => {
          onNew(true);
          const text = query.trim();
          onPick({
            id: null,
            name: text.includes('@') || isPhoneQuery(text) ? '' : text,
            email: text.includes('@') ? text : '',
            phone: isPhoneQuery(text) ? text : '',
          });
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:border-stone-500"
      >
        <UserPlus className="h-4 w-4" />{t.newCustomer}
      </button>
    </div>
  );
}
