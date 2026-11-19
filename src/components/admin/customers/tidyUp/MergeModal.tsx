import { useState } from 'react';
import { Ban, Check, Loader2, Mail, Merge, Phone, UserX, Users, X } from 'lucide-react';
import { useAdminText } from '../../../../lib/adminLanguage';
import { fillText } from '../../../../lib/bookingLanguage';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../../adminUi';
import { defaultSelection, mergeOptions, mergeRequest, type MergeCandidate, type MergeSelection } from './mergeChoice';
import { dismissDuplicates, mergeCustomers } from './tidyUpApi';
import { TIDY_UP_TEXT } from './tidyUpText';

interface MergeModalProps {
  customers: MergeCandidate[];
  onClose: () => void;
  /** After a merge or "not the same person": reload the list. */
  onDone: () => void;
}

/** One radio list of values (name, email or phone) the merged customer keeps. */
function Choice({ label, options, value, onChange, emptyLabel }: {
  label: string; options: string[]; value: string | null; onChange: (value: string | null) => void; emptyLabel?: string;
}) {
  const all: (string | null)[] = emptyLabel ? [...options, null] : options;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-stone-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((option) => {
          const isActive = option === value;
          return (
            <button key={option ?? 'none'} type="button" role="radio" aria-checked={isActive} onClick={() => onChange(option)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-xl px-3 py-2 text-left text-sm transition ${isActive
                ? 'bg-[#1A1714] text-white'
                : 'bg-white text-stone-700 ring-1 ring-stone-200/80 hover:ring-stone-300'}`}>
              {isActive && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
              <span className="break-all">{option ?? emptyLabel}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function MergeModal({ customers, onClose, onDone }: MergeModalProps) {
  const { t } = useAdminText(TIDY_UP_TEXT);
  const [selection, setSelection] = useState<MergeSelection>(() => defaultSelection(customers));
  const [busy, setBusy] = useState<'merge' | 'dismiss' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const options = mergeOptions(customers, selection.includedIds);

  const toggle = (id: string) => {
    const includedIds = selection.includedIds.includes(id)
      ? selection.includedIds.filter((included) => included !== id)
      : [...selection.includedIds, id];
    const next = mergeOptions(customers, includedIds);
    // Keep each choice valid when its customer is unticked.
    setSelection({
      includedIds,
      name: next.names.includes(selection.name) ? selection.name : next.names[0] ?? selection.name,
      email: next.emails.some((email) => email.toLowerCase() === selection.email.toLowerCase()) ? selection.email : next.emails[0] ?? selection.email,
      phone: selection.phone === null || next.phones.includes(selection.phone) ? selection.phone : next.phones[0] ?? null,
    });
    setError(null);
  };

  const run = async (kind: 'merge' | 'dismiss', action: () => Promise<void>, failure: string) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      onDone();
    } catch (actionError) {
      console.error('Tidy-up failed:', actionError);
      const message = actionError instanceof Error ? actionError.message : '';
      setError(message.includes('own login') ? t.loginConflict : failure);
      setBusy(null);
    }
  };

  const merge = () => {
    const request = mergeRequest(customers, selection);
    if (!request) {
      setError(t.chooseTwo);
      return;
    }
    void run('merge', () => mergeCustomers(request), t.failed);
  };

  const includedCount = selection.includedIds.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1A1714]/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="merge-title">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#F7F5F2] shadow-[0_24px_80px_rgba(26,23,20,0.35)]">
        <button type="button" onClick={onClose} aria-label={t.close}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-900/5 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>

        <div className="px-7 pb-2 pt-8">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1A1714] text-white">
            <Users className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
          </div>
          <h2 id="merge-title" className="text-[22px] font-semibold leading-tight tracking-tight text-[#1A1714]">{t.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{t.reviewIntro}</p>
        </div>

        <div className="grid gap-3 px-7 pt-4 sm:grid-cols-2">
          {customers.map((customer) => {
            const isIncluded = selection.includedIds.includes(customer.id);
            return (
              <button key={customer.id} type="button" role="checkbox" aria-checked={isIncluded} onClick={() => toggle(customer.id)}
                className={`relative rounded-2xl px-4 py-3.5 text-left transition ${isIncluded
                  ? 'bg-white shadow-[0_2px_14px_rgba(26,23,20,0.10)] ring-2 ring-[#1A1714]'
                  : 'bg-white/50 opacity-60 ring-1 ring-stone-200/80 hover:opacity-90'}`}>
                <span className={`absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-md ${isIncluded ? 'bg-[#1A1714] text-white' : 'bg-white ring-1 ring-stone-300'}`}>
                  {isIncluded && <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />}
                </span>
                <span className="block pr-7 text-sm font-semibold text-[#1A1714]">{customer.name}</span>
                <span className="mt-1 flex items-center gap-1.5 break-all text-xs text-stone-600"><Mail className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden="true" />{customer.email}</span>
                {customer.phone && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-600"><Phone className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden="true" />{customer.phone}</span>
                )}
                <span className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{customer.visits_count === 1 ? t.visitOne : fillText(t.visits, { count: customer.visits_count ?? 0 })}</span>
                  {customer.blocked_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700"><Ban className="h-3 w-3" aria-hidden="true" />{t.blocked}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {includedCount >= 2 && (
          <div className="space-y-4 px-7 pt-6">
            <Choice label={t.keepName} options={options.names} value={selection.name} onChange={(name) => name && setSelection({ ...selection, name })} />
            <Choice label={t.keepEmail} options={options.emails}
              value={options.emails.find((email) => email === selection.email)
                ?? options.emails.find((email) => email.toLowerCase() === selection.email.toLowerCase()) ?? null}
              onChange={(email) => email && setSelection({ ...selection, email })} />
            <Choice label={t.keepPhone} options={options.phones} value={selection.phone} emptyLabel={t.noPhone}
              onChange={(phone) => setSelection({ ...selection, phone })} />
            <p className="text-xs leading-relaxed text-stone-500">{t.mergeNote}</p>
          </div>
        )}

        {error && <p role="alert" className="mx-7 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 px-7 pb-7 pt-6">
          <button type="button" className={ADMIN_SECONDARY_BUTTON} disabled={busy !== null}
            onClick={() => run('dismiss', () => dismissDuplicates(customers.map((customer) => customer.id)), t.dismissFailed)}>
            {busy === 'dismiss' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserX className="h-4 w-4" aria-hidden="true" />} {t.notSame}
          </button>
          <button type="button" className={ADMIN_PRIMARY_BUTTON} disabled={busy !== null || includedCount < 2} onClick={merge}>
            {busy === 'merge' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Merge className="h-4 w-4" aria-hidden="true" />}
            {busy === 'merge' ? t.merging : fillText(t.merge, { count: includedCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
