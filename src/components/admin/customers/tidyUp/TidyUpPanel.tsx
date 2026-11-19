import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAdminText } from '../../../../lib/adminLanguage';
import { fillText } from '../../../../lib/bookingLanguage';
import { ADMIN_SECONDARY_BUTTON } from '../../adminUi';
import type { DuplicateGroup, DuplicateReason } from './duplicateGroups';
import type { MergeCandidate } from './mergeChoice';
import MergeModal from './MergeModal';
import { TIDY_UP_TEXT } from './tidyUpText';

interface TidyUpPanelProps {
  groups: DuplicateGroup[];
  onChanged: () => void;
}

/**
 * Possible duplicates, one row per group: who, why, and one "Review" button
 * that opens the merge popup (admin design rule: no actions inside rows).
 */
export default function TidyUpPanel({ groups, onChanged }: TidyUpPanelProps) {
  const { t } = useAdminText(TIDY_UP_TEXT);
  const [openGroup, setOpenGroup] = useState<DuplicateGroup | null>(null);
  const reasonLabel: Record<DuplicateReason, string> = { email: t.sameEmail, phone: t.samePhone, name: t.sameName };

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/70 px-6 py-14 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-stone-600">{t.empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">{t.intro}</p>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/70 bg-white/70 shadow-[0_2px_16px_rgba(26,23,20,0.05)]">
        {groups.map((group) => (
          <li key={group.customers.map((customer) => customer.id).join('|')} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${group.isLikely ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/70' : 'bg-stone-100 text-stone-600'}`}>
                  {group.isLikely ? t.likely : t.check}
                </span>
                {group.reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-stone-600 ring-1 ring-stone-200/80">{reasonLabel[reason]}</span>
                ))}
                <span className="text-[11px] text-stone-400">{fillText(t.customersCount, { count: group.customers.length })}</span>
              </div>
              <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {group.customers.map((customer) => (
                  <div key={customer.id} className="min-w-0 text-sm">
                    <span className="font-medium text-[#1A1714]">{customer.name}</span>
                    <span className="block truncate text-xs text-stone-500">{[customer.email, customer.phone].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" className={ADMIN_SECONDARY_BUTTON} onClick={() => setOpenGroup(group)}>{t.review}</button>
          </li>
        ))}
      </ul>

      {openGroup && (
        <MergeModal
          customers={openGroup.customers as MergeCandidate[]}
          onClose={() => setOpenGroup(null)}
          onDone={() => { setOpenGroup(null); onChanged(); }}
        />
      )}
    </div>
  );
}
