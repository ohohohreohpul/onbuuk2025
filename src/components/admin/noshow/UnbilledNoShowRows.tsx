import { Banknote, Loader2 } from 'lucide-react';
import type { UnbilledNoShow } from '../../../lib/noShowFees';
import type { Translations } from '../../../lib/bookingLanguage';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_PRIMARY_BUTTON, ADMIN_STATUS_PILL } from '../adminUi';

const TEXT: Translations<{ noShow: string; notBilled: string; adding: string; addFee: string; addFeeHint: string }> = {
  en: { noShow: 'No-Show', notBilled: 'Not billed', adding: 'Adding fee…', addFee: 'Add fee', addFeeHint: 'Creates the fee so you can charge, record or waive it.' },
  de: { noShow: 'No-Show', notBilled: 'Nicht berechnet', adding: 'Gebühr wird angelegt…', addFee: 'Gebühr anlegen', addFeeHint: 'Legt die Gebühr an, damit Sie sie belasten, als bezahlt erfassen oder erlassen können.' },
  th: { noShow: 'ไม่มาตามนัด', notBilled: 'ยังไม่เรียกเก็บ', adding: 'กำลังเพิ่มค่าธรรมเนียม…', addFee: 'เพิ่มค่าธรรมเนียม', addFeeHint: 'สร้างค่าธรรมเนียมเพื่อเรียกเก็บ บันทึกการชำระ หรือยกเว้น' },
};

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
  const { t } = useAdminText(TEXT);
  return (
    <>
      {rows.map((row) => (
        <tr key={`unbilled-${row.id}`} className="bg-amber-50/30 transition-colors hover:bg-amber-50/60">
          <td className="px-6 py-4">
            <div className="text-sm font-medium text-stone-800">{row.customer_name}</div>
            <div className="text-xs text-stone-500">{row.customer_email}</div>
          </td>
          <td className="px-6 py-4">
            <span className={`${ADMIN_STATUS_PILL} bg-amber-50 text-amber-700`}>{t.noShow}</span>
            <div className="mt-1 text-xs text-stone-500">{row.serviceName} · {formatDate(row.booking_date)}</div>
          </td>
          <td className="px-6 py-4 text-sm font-medium text-stone-800">{formatPrice(row.feeCents)}</td>
          <td className="px-6 py-4 text-sm text-stone-400">—</td>
          <td className="px-6 py-4">
            <span className={`${ADMIN_STATUS_PILL} bg-stone-100 text-stone-600`}>{t.notBilled}</span>
          </td>
          <td className="min-w-[310px] px-6 py-4">
            {activeId === row.id ? (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.adding}
              </div>
            ) : (
              <div>
                <button type="button" onClick={() => onAddFee(row)} className={`${ADMIN_PRIMARY_BUTTON} px-3 py-2 text-xs`}>
                  <Banknote className="h-3.5 w-3.5" />
                  {t.addFee}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-stone-400">{t.addFeeHint}</p>
              </div>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
