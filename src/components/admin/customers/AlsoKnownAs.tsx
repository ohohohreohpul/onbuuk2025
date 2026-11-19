import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, Phone, X } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';
import { loadCustomerAliases, removeCustomerAlias, type CustomerAlias } from './tidyUp/tidyUpApi';

const TEXT: Translations<{ title: string; hint: string; remove: string; confirmRemove: string; failed: string }> = {
  en: {
    title: 'Also known as', hint: 'From merged customers. Bookings with these still count for this customer.',
    remove: 'Remove {value}',
    confirmRemove: 'Remove {value}? Bookings made with it will no longer count for this customer, and the next booking with it creates a separate customer.',
    failed: 'Could not remove. Please try again.',
  },
  de: {
    title: 'Auch bekannt als', hint: 'Aus zusammengeführten Kunden. Buchungen damit zählen weiter für diesen Kunden.',
    remove: '{value} entfernen',
    confirmRemove: '{value} entfernen? Buchungen damit zählen dann nicht mehr für diesen Kunden, und die nächste Buchung damit legt einen eigenen Kunden an.',
    failed: 'Entfernen fehlgeschlagen. Bitte erneut versuchen.',
  },
  th: {
    title: 'ชื่อ/ข้อมูลอื่นที่รู้จัก', hint: 'จากลูกค้าที่รวมกัน การจองด้วยข้อมูลเหล่านี้ยังนับเป็นของลูกค้านี้',
    remove: 'ลบ {value}',
    confirmRemove: 'ลบ {value} หรือไม่? การจองด้วยข้อมูลนี้จะไม่นับเป็นของลูกค้านี้อีก และการจองครั้งถัดไปจะสร้างลูกค้าใหม่แยกต่างหาก',
    failed: 'ลบไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
};

interface AlsoKnownAsProps {
  businessId: string;
  customerId: string;
  /** After a removal: bookings and stats of the customer change. */
  onChanged: () => void;
}

/** Earlier emails and phone numbers of a merged customer, each removable. Hidden when there are none. */
export default function AlsoKnownAs({ businessId, customerId, onChanged }: AlsoKnownAsProps) {
  const { t } = useAdminText(TEXT);
  const [aliases, setAliases] = useState<CustomerAlias[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const byCustomer = await loadCustomerAliases(businessId, customerId);
      setAliases(byCustomer.get(customerId) ?? []);
    } catch (loadError) {
      console.error('Could not load also-known-as:', loadError);
    }
  }, [businessId, customerId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (alias: CustomerAlias) => {
    if (!window.confirm(fillText(t.confirmRemove, { value: alias.value }))) return;
    setBusyKey(alias.key);
    setError(null);
    try {
      await removeCustomerAlias(customerId, alias.kind, alias.key);
      await load();
      onChanged();
    } catch (removeError) {
      console.error('Could not remove alias:', removeError);
      setError(t.failed);
    } finally {
      setBusyKey(null);
    }
  };

  if (aliases.length === 0) return null;

  return (
    <div className="border-b border-stone-100 px-6 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">{t.title}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {aliases.map((alias) => {
          const Icon = alias.kind === 'email' ? Mail : Phone;
          return (
            <li key={`${alias.kind}:${alias.key}`} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm text-stone-700">
              <Icon className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
              <span className="break-all">{alias.value}</span>
              <button type="button" onClick={() => remove(alias)} disabled={busyKey !== null}
                aria-label={fillText(t.remove, { value: alias.value })}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-400 transition hover:bg-white hover:text-red-700">
                {busyKey === alias.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-stone-500">{t.hint}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
