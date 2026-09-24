import { Banknote, Loader2 } from 'lucide-react';
import type { UnbilledNoShow } from '../../../lib/noShowFees';
import { ADMIN_PRIMARY_BUTTON, ADMIN_STATUS_PILL } from '../adminUi';

export interface UnbilledNoShowRow extends UnbilledNoShow {
  customer_name: string;
}

interface UnbilledNoShowRowsProps {
  rows: UnbilledNoShowRow[];
  activeId: string | null;
  formatPrice: (cents: number) => string;
  formatDate: (date: string) => string;
  onAddFee: (row: UnbilledNoShowRow) => void;
}

export default function UnbilledNoShowRows({ rows, activeId, formatPrice, formatDate, onAddFee }: UnbilledNoShowRowsProps) {
  return (
    <>
      {rows.map((row) => (
        <tr key={`unbilled-${row.id}`} className="bg-amber-50/30 transition-colors hover:bg-amber-50/60">
          <td className="px-6 py-4">
            <div className="text-sm font-medium text-stone-800">{row.customer_name}</div>
            <div className="text-xs text-stone-500">{row.customer_email}</div>
          </td>
          <td className="px-6 py-4">
            <span className={`${ADMIN_STATUS_PILL} bg-amber-50 text-amber-700`}>No-Show</span>
            <div className="mt-1 text-xs text-stone-500">{row.serviceName} · {formatDate(row.booking_date)}</div>
          </td>
          <td className="px-6 py-4 text-sm font-medium text-stone-800">{formatPrice(row.feeCents)}</td>
          <td className="px-6 py-4 text-sm text-stone-400">—</td>
          <td className="px-6 py-4">
            <span className={`${ADMIN_STATUS_PILL} bg-stone-100 text-stone-600`}>Not billed</span>
          </td>
          <td className="min-w-[310px] px-6 py-4">
            {activeId === row.id ? (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding fee…
              </div>
            ) : (
              <div>
                <button type="button" onClick={() => onAddFee(row)} className={`${ADMIN_PRIMARY_BUTTON} px-3 py-2 text-xs`}>
                  <Banknote className="h-3.5 w-3.5" />
                  Add fee
                </button>
                <p className="mt-2 text-[11px] leading-4 text-stone-400">Creates the fee so you can charge, record or waive it.</p>
              </div>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
