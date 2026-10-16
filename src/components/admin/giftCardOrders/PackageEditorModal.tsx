import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SELECT } from '../adminUi';
import CalendarModal from '../calendar/CalendarModal';
import { loadPackageDraft, loadServiceOptions, savePackage, type PackageDraft, type ServiceOption } from './giftCardOrdersApi';
import { centsToEuro, cleanItems, dayToIso, euroToCents, findProblem, isoToDay } from './packageDraft';
import { PACKAGE_EDITOR_TEXT } from './packageEditorText';

interface ItemForm {
  kind: 'service_pass' | 'value';
  serviceId: string;
  durationId: string;
  value: string;
  quantity: string;
}

interface Form {
  name: string; subtitle: string; description: string; price: string; compare: string;
  gift: string; from: string; until: string; stock: string; isActive: boolean; items: ItemForm[];
}

const EMPTY_ITEM: ItemForm = { kind: 'service_pass', serviceId: '', durationId: '', value: '', quantity: '1' };
const EMPTY_FORM: Form = { name: '', subtitle: '', description: '', price: '', compare: '', gift: '', from: '', until: '', stock: '', isActive: true, items: [EMPTY_ITEM] };

function toForm(draft: PackageDraft): Form {
  return {
    name: draft.name, subtitle: draft.subtitle, description: draft.description,
    price: centsToEuro(draft.price_cents), compare: centsToEuro(draft.compare_at_cents), gift: draft.bonus_note,
    from: isoToDay(draft.valid_from, false), until: isoToDay(draft.valid_until, true),
    stock: draft.stock_limit === null ? '' : String(draft.stock_limit), isActive: draft.is_active,
    items: draft.items.map((item) => ({
      kind: item.kind, serviceId: item.service_id ?? '', durationId: item.duration_id ?? '',
      value: centsToEuro(item.value_cents), quantity: String(item.quantity),
    })),
  };
}

function toDraft(form: Form): PackageDraft {
  const stock = form.stock.trim() ? Number.parseInt(form.stock, 10) : null;
  return {
    name: form.name.trim(), subtitle: form.subtitle.trim(), description: form.description.trim(),
    price_cents: euroToCents(form.price) ?? 0, compare_at_cents: euroToCents(form.compare), bonus_note: form.gift.trim(),
    valid_from: dayToIso(form.from, false), valid_until: dayToIso(form.until, true),
    stock_limit: stock !== null && Number.isFinite(stock) && stock >= 0 ? stock : null, is_active: form.isActive,
    items: cleanItems(form.items.map((item) => ({
      kind: item.kind, service_id: item.serviceId || null, duration_id: item.durationId || null,
      value_cents: euroToCents(item.value), quantity: Number.parseInt(item.quantity, 10) || 0, label: '',
    }))),
  };
}

interface PackageEditorModalProps {
  businessId: string;
  packageId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create or edit a voucher set: name, price, contents, gift, sale dates, stock. */
export default function PackageEditorModal({ businessId, packageId, onClose, onSaved }: PackageEditorModalProps) {
  const { t } = useAdminText(PACKAGE_EDITOR_TEXT);
  const [form, setForm] = useState<Form | null>(packageId ? null : EMPTY_FORM);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([loadServiceOptions(businessId), packageId ? loadPackageDraft(packageId) : Promise.resolve(null)])
      .then(([options, draft]) => {
        if (!isCurrent) return;
        setServices(options);
        if (draft) setForm(toForm(draft));
      })
      .catch((loadError) => {
        console.error('Could not load the voucher set:', loadError);
        if (isCurrent) setError(t.loadFailed);
      });
    return () => { isCurrent = false; };
  }, [businessId, packageId, t.loadFailed]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const setItem = (index: number, patch: Partial<ItemForm>) =>
    setForm((f) => (f ? { ...f, items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) } : f));

  const save = async () => {
    if (!form) return;
    const draft = toDraft(form);
    const problem = findProblem(draft);
    if (problem) { setError(t[problem]); return; }
    setIsSaving(true);
    setError(null);
    try {
      await savePackage(packageId, draft);
      onSaved();
    } catch (saveError) {
      console.error('Could not save the voucher set:', saveError);
      setError((saveError as { message?: string })?.message || t.saveFailed);
      setIsSaving(false);
    }
  };

  const label = 'block text-sm font-medium text-stone-700';
  return (
    <CalendarModal title={packageId ? t.editTitle : t.newTitle} closeLabel={t.close} onClose={onClose} maxWidthClass="max-w-2xl">
      {!form ? (
        error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          : <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>
      ) : (
        <div className="space-y-4">
          <label className={label}>{t.name}
            <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} placeholder={t.namePlaceholder} className={`${ADMIN_INPUT} mt-1`} />
          </label>
          <label className={label}>{t.subtitle}
            <input value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={160} placeholder={t.subtitlePlaceholder} className={`${ADMIN_INPUT} mt-1`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>{t.price}
              <input value={form.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" placeholder="180,00" className={`${ADMIN_INPUT} mt-1`} />
            </label>
            <label className={label}>{t.comparePrice}
              <input value={form.compare} onChange={(e) => set('compare', e.target.value)} inputMode="decimal" placeholder="210,00" className={`${ADMIN_INPUT} mt-1`} />
              <span className="mt-1 block text-xs font-normal text-stone-400">{t.comparePriceHint}</span>
            </label>
          </div>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-900/[0.06]">
            <h3 className="text-sm font-semibold text-[#1A1714]">{t.contents}</h3>
            <p className="text-xs text-stone-500">{t.contentsHint}</p>
            <div className="mt-3 space-y-3">
              {form.items.map((item, index) => {
                const service = services.find((s) => s.id === item.serviceId);
                return (
                  <div key={index} className="grid gap-2 rounded-xl bg-stone-900/[0.03] p-3 sm:grid-cols-[150px_1fr_auto]">
                    <select value={item.kind} onChange={(e) => setItem(index, { kind: e.target.value as ItemForm['kind'] })} className={ADMIN_SELECT} aria-label={t.contents}>
                      <option value="service_pass">{t.kindPass}</option>
                      <option value="value">{t.kindValue}</option>
                    </select>
                    {item.kind === 'service_pass' ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_120px_90px]">
                        <select value={item.serviceId} onChange={(e) => setItem(index, { serviceId: e.target.value, durationId: '' })} className={ADMIN_SELECT} aria-label={t.treatment}>
                          <option value="">{t.chooseTreatment}</option>
                          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select value={item.durationId} onChange={(e) => setItem(index, { durationId: e.target.value })} className={ADMIN_SELECT} aria-label={t.duration} disabled={!service}>
                          <option value="">{t.duration}</option>
                          {service?.durations.map((d) => <option key={d.id} value={d.id}>{d.duration_minutes} min</option>)}
                        </select>
                        <input value={item.quantity} onChange={(e) => setItem(index, { quantity: e.target.value })} inputMode="numeric" aria-label={t.visits} title={t.visits} className={ADMIN_INPUT} />
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={item.value} onChange={(e) => setItem(index, { value: e.target.value })} inputMode="decimal" placeholder={t.amount} aria-label={t.amount} className={ADMIN_INPUT} />
                        <input value={item.quantity} onChange={(e) => setItem(index, { quantity: e.target.value })} inputMode="numeric" aria-label={t.count} title={t.count} className={ADMIN_INPUT} />
                      </div>
                    )}
                    <button type="button" onClick={() => set('items', form.items.filter((_, i) => i !== index))} disabled={form.items.length === 1}
                      aria-label={t.removeItem} className="self-center rounded-lg p-2 text-stone-400 hover:bg-stone-900/[0.05] hover:text-red-600 disabled:opacity-30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => set('items', [...form.items, EMPTY_ITEM])} disabled={form.items.length >= 10}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-[#1A1714] disabled:opacity-40">
              <Plus className="h-4 w-4" />{t.addItem}
            </button>
          </section>

          <label className={label}>{t.gift}
            <input value={form.gift} onChange={(e) => set('gift', e.target.value)} maxLength={300} placeholder={t.giftPlaceholder} className={`${ADMIN_INPUT} mt-1`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>{t.from}<input type="date" value={form.from} onChange={(e) => set('from', e.target.value)} className={`${ADMIN_INPUT} mt-1`} /></label>
            <label className={label}>{t.until}<input type="date" value={form.until} onChange={(e) => set('until', e.target.value)} className={`${ADMIN_INPUT} mt-1`} /></label>
            <label className={label}>{t.stock}
              <input value={form.stock} onChange={(e) => set('stock', e.target.value)} inputMode="numeric" className={`${ADMIN_INPUT} mt-1`} />
              <span className="mt-1 block text-xs font-normal text-stone-400">{t.stockHint}</span>
            </label>
          </div>
          <label className={label}>{t.description}
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} rows={3} className={`${ADMIN_INPUT} mt-1`} />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 accent-[#1A1714]" />{t.onSale}
          </label>

          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.cancel}</button>
            <button type="button" onClick={save} disabled={isSaving} className={ADMIN_PRIMARY_BUTTON}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isSaving ? t.saving : t.save}
            </button>
          </div>
        </div>
      )}
    </CalendarModal>
  );
}
