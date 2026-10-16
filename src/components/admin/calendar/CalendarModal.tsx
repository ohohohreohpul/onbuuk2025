import { ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ADMIN_MODAL, ADMIN_MODAL_BACKDROP } from '../adminUi';

interface CalendarModalProps {
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

/** Popup frame for the calendar: rendered above everything, closes on Escape or backdrop click. */
export default function CalendarModal({ title, subtitle, closeLabel, onClose, children, maxWidthClass = 'max-w-md' }: CalendarModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className={ADMIN_MODAL_BACKDROP}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={`${ADMIN_MODAL} max-h-[90vh] ${maxWidthClass} overflow-y-auto`}>
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-[#1A1714]">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="rounded-lg p-2 text-stone-400 hover:bg-stone-900/[0.05] hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
