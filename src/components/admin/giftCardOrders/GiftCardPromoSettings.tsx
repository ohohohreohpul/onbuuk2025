import { useEffect, useState } from 'react';
import { Gift, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import {
  promoFormFromSettings,
  promoPayloadFromForm,
  type PromoForm,
  type PromoSettingsRow,
} from '../../../lib/giftCardPromo';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SURFACE } from '../adminUi';

const PROMO_COLUMNS =
  'pay_in_store_enabled, promo_title, promo_text, promo_gift_note, promo_gift_min_cents, promo_gift_min_minutes, promo_valid_from, promo_valid_until';

/** Voucher promotion: banner text, gift for qualifying orders, pay in the shop. */
export default function GiftCardPromoSettings() {
  const { businessId } = useTenant();
  const [form, setForm] = useState<PromoForm>(promoFormFromSettings(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('gift_card_settings')
      .select(PROMO_COLUMNS)
      .eq('business_id', businessId)
      .maybeSingle<PromoSettingsRow>()
      .then(({ data, error }) => {
        if (error) {
          console.error('Could not load the voucher promotion:', error);
          setNotice({ tone: 'error', text: 'Could not load the promotion.' });
        }
        setForm(promoFormFromSettings(data));
        setIsLoading(false);
      });
  }, [businessId]);

  const update = <K extends keyof PromoForm>(key: K, value: PromoForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!businessId) return;
    const result = promoPayloadFromForm(form);
    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    const { error } = await supabase
      .from('gift_card_settings')
      .upsert({ business_id: businessId, ...result.payload, updated_at: new Date().toISOString() }, { onConflict: 'business_id' });
    setIsSaving(false);
    if (error) {
      console.error('Could not save the voucher promotion:', error);
      setNotice({ tone: 'error', text: 'Could not save. Please try again.' });
      return;
    }
    setNotice({ tone: 'success', text: 'Promotion saved.' });
  };

  const field = (id: keyof PromoForm, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label htmlFor={`promo-${id}`} className="block">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <input
        id={`promo-${id}`}
        className={`${ADMIN_INPUT} mt-1.5`}
        value={form[id] as string}
        onChange={(e) => update(id, e.target.value)}
        disabled={isLoading}
        {...props}
      />
    </label>
  );

  return (
    <section aria-labelledby="promo-heading" className={`${ADMIN_SURFACE} p-6`}>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]">
          <Gift className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div>
          <h2 id="promo-heading" className="font-semibold text-[#1A1714]">Promotion &amp; gift</h2>
          <p className="mt-1 text-sm text-stone-500">
            Shown as a banner on your voucher page. Orders that reach the minimum get the gift note; you tick it off when you hand it over.
          </p>
        </div>
      </div>

      <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-xl bg-stone-50 px-4 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#1A1714]"
          checked={form.payInStoreEnabled}
          disabled={isLoading}
          onChange={(e) => update('payInStoreEnabled', e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-stone-800">Customers may order online and pay in the shop</span>
          <span className="block text-xs text-stone-500">Vouchers stay inactive until you press "Paid – activate vouchers" in Orders &amp; sets.</span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field('title', 'Banner title', { maxLength: 120, placeholder: 'Exklusive Gutscheinsets zur Weihnachtszeit' })}</div>
        <label htmlFor="promo-text" className="block sm:col-span-2">
          <span className="text-sm font-medium text-stone-700">Banner text</span>
          <textarea
            id="promo-text"
            rows={3}
            maxLength={500}
            className={`${ADMIN_INPUT} mt-1.5`}
            value={form.text}
            disabled={isLoading}
            onChange={(e) => update('text', e.target.value)}
            placeholder="Zu jedem Gutscheinkauf ab 70 € erhalten Sie bei Bezahlung im Studio ein kleines Geschenk."
          />
        </label>
        <div className="sm:col-span-2">{field('giftNote', 'Gift (shown on qualifying orders)', { maxLength: 300, placeholder: 'Kleine Überraschung von uns' })}</div>
        {field('giftMinEuros', 'Gift from amount (€)', { inputMode: 'decimal', placeholder: '70' })}
        {field('giftMinMinutes', 'or from treatment minutes', { inputMode: 'numeric', placeholder: '60' })}
        {field('validFrom', 'Starts', { type: 'date' })}
        {field('validUntil', 'Ends (including this day)', { type: 'date' })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-stone-200/70 pt-5">
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
            {notice.text}
          </p>
        )}
        <button type="button" onClick={save} disabled={isLoading || isSaving} className={ADMIN_PRIMARY_BUTTON}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Save promotion'}
        </button>
      </div>
    </section>
  );
}
