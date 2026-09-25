import { X } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { ADMIN_MODAL, ADMIN_MODAL_BACKDROP } from '../adminUi';
import ExportFeedSection from './ExportFeedSection';
import ImportCalendarsSection from './ImportCalendarsSection';

interface CalendarSyncModalProps {
  specialistId: string;
  specialistName: string;
  onClose: () => void;
}

export default function CalendarSyncModal({ specialistId, specialistName, onClose }: CalendarSyncModalProps) {
  const { businessId } = useTenant();

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="calendar-sync-title" onClick={onClose}>
      <div className={`${ADMIN_MODAL} max-h-[90vh] max-w-2xl overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-stone-200/70 px-6 py-5">
          <div>
            <h2 id="calendar-sync-title" className="text-xl font-semibold tracking-tight text-[#1A1714]">
              Calendar sync
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">{specialistName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-stone-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        {businessId ? (
          <div className="space-y-8 px-6 py-6">
            <ImportCalendarsSection businessId={businessId} specialistId={specialistId} />
            <div className="border-t border-stone-200/70" />
            <ExportFeedSection businessId={businessId} specialistId={specialistId} specialistName={specialistName} />
          </div>
        ) : (
          <p className="px-6 py-6 text-sm text-stone-500">Loading…</p>
        )}
      </div>
    </div>
  );
}
