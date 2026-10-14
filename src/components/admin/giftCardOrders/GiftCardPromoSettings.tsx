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
import { useAdminText } from '../../../lib/adminLanguage';
import { Translations } from '../../../lib/bookingLanguage';

const PROMO_COLUMNS =
  'pay_in_store_enabled, promo_title, promo_text, promo_gift_note, promo_gift_min_cents, promo_gift_min_minutes, promo_valid_from, promo_valid_until';

const TEXT: Translations<{
  loadError: string; saveError: string; saved: string; heading: string; intro: string;
  payInShop: string; payInShopHint: string; bannerTitle: string; bannerTitlePlaceholder: string;
  bannerText: string; bannerTextPlaceholder: string; gift: string; giftPlaceholder: string;
  giftMinAmount: string; giftMinMinutes: string; starts: string; ends: string; saving: string; save: string;
}> = {
  en: {
    loadError: 'Could not load the promotion.', saveError: 'Could not save. Please try again.', saved: 'Promotion saved.',
    heading: 'Promotion & gift',
    intro: 'Shown as a banner on your voucher page. Orders that reach the minimum get the gift note; you tick it off when you hand it over.',
    payInShop: 'Customers may order online and pay in the shop',
    payInShopHint: 'Vouchers stay inactive until you press "Paid – activate vouchers" in Orders & sets.',
    bannerTitle: 'Banner title', bannerTitlePlaceholder: 'Exclusive voucher sets for the holidays',
    bannerText: 'Banner text', bannerTextPlaceholder: 'Get a small gift with every voucher purchase from €70 when you pay in the studio.',
    gift: 'Gift (shown on qualifying orders)', giftPlaceholder: 'A little surprise from us',
    giftMinAmount: 'Gift from amount (€)', giftMinMinutes: 'or from treatment minutes',
    starts: 'Starts', ends: 'Ends (including this day)', saving: 'Saving…', save: 'Save promotion',
  },
  de: {
    loadError: 'Die Aktion konnte nicht geladen werden.', saveError: 'Speichern fehlgeschlagen. Bitte erneut versuchen.', saved: 'Aktion gespeichert.',
    heading: 'Aktion & Geschenk',
    intro: 'Wird als Banner auf Ihrer Gutscheinseite angezeigt. Bestellungen ab dem Mindestwert erhalten den Geschenkhinweis; Sie haken ihn bei der Übergabe ab.',
    payInShop: 'Kund:innen dürfen online bestellen und vor Ort bezahlen',
    payInShopHint: 'Gutscheine bleiben inaktiv, bis Sie unter „Bestellungen & Pakete“ auf „Bezahlt – Gutscheine aktivieren“ klicken.',
    bannerTitle: 'Banner-Titel', bannerTitlePlaceholder: 'Exklusive Gutscheinsets zur Weihnachtszeit',
    bannerText: 'Banner-Text', bannerTextPlaceholder: 'Zu jedem Gutscheinkauf ab 70 € erhalten Sie bei Bezahlung im Studio ein kleines Geschenk.',
    gift: 'Geschenk (bei qualifizierten Bestellungen angezeigt)', giftPlaceholder: 'Kleine Überraschung von uns',
    giftMinAmount: 'Geschenk ab Betrag (€)', giftMinMinutes: 'oder ab Behandlungsminuten',
    starts: 'Beginn', ends: 'Ende (einschließlich dieses Tages)', saving: 'Speichern…', save: 'Aktion speichern',
  },
  th: {
    loadError: 'โหลดโปรโมชันไม่สำเร็จ', saveError: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', saved: 'บันทึกโปรโมชันแล้ว',
    heading: 'โปรโมชันและของแถม',
    intro: 'แสดงเป็นแบนเนอร์บนหน้าบัตรของขวัญ คำสั่งซื้อที่ถึงยอดขั้นต่ำจะมีหมายเหตุของแถม และคุณติ๊กเมื่อส่งมอบแล้ว',
    payInShop: 'ลูกค้าสั่งซื้อออนไลน์และชำระที่ร้านได้',
    payInShopHint: 'บัตรของขวัญจะยังไม่เปิดใช้จนกว่าคุณจะกด "ชำระแล้ว – เปิดใช้บัตรของขวัญ" ในหน้าคำสั่งซื้อและแพ็กเกจ',
    bannerTitle: 'หัวข้อแบนเนอร์', bannerTitlePlaceholder: 'แพ็กเกจบัตรของขวัญสุดพิเศษช่วงเทศกาล',
    bannerText: 'ข้อความแบนเนอร์', bannerTextPlaceholder: 'ซื้อบัตรของขวัญตั้งแต่ 70 € และชำระที่ร้าน รับของขวัญเล็กๆ ทันที',
    gift: 'ของแถม (แสดงในคำสั่งซื้อที่ได้รับสิทธิ์)', giftPlaceholder: 'เซอร์ไพรส์เล็กๆ จากเรา',
    giftMinAmount: 'ของแถมเมื่อซื้อตั้งแต่ (€)', giftMinMinutes: 'หรือเมื่อทรีตเมนต์ตั้งแต่ (นาที)',
    starts: 'เริ่ม', ends: 'สิ้นสุด (รวมวันนี้)', saving: 'กำลังบันทึก…', save: 'บันทึกโปรโมชัน',
  },
};

/** Voucher promotion: banner text, gift for qualifying orders, pay in the shop. */
export default function GiftCardPromoSettings() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
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
          setNotice({ tone: 'error', text: t.loadError });
        }
        setForm(promoFormFromSettings(data));
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the business changes, not the language
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
      setNotice({ tone: 'error', text: t.saveError });
      return;
    }
    setNotice({ tone: 'success', text: t.saved });
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
          <h2 id="promo-heading" className="font-semibold text-[#1A1714]">{t.heading}</h2>
          <p className="mt-1 text-sm text-stone-500">{t.intro}</p>
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
          <span className="block text-sm font-medium text-stone-800">{t.payInShop}</span>
          <span className="block text-xs text-stone-500">{t.payInShopHint}</span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field('title', t.bannerTitle, { maxLength: 120, placeholder: t.bannerTitlePlaceholder })}</div>
        <label htmlFor="promo-text" className="block sm:col-span-2">
          <span className="text-sm font-medium text-stone-700">{t.bannerText}</span>
          <textarea
            id="promo-text"
            rows={3}
            maxLength={500}
            className={`${ADMIN_INPUT} mt-1.5`}
            value={form.text}
            disabled={isLoading}
            onChange={(e) => update('text', e.target.value)}
            placeholder={t.bannerTextPlaceholder}
          />
        </label>
        <div className="sm:col-span-2">{field('giftNote', t.gift, { maxLength: 300, placeholder: t.giftPlaceholder })}</div>
        {field('giftMinEuros', t.giftMinAmount, { inputMode: 'decimal', placeholder: '70' })}
        {field('giftMinMinutes', t.giftMinMinutes, { inputMode: 'numeric', placeholder: '60' })}
        {field('validFrom', t.starts, { type: 'date' })}
        {field('validUntil', t.ends, { type: 'date' })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-stone-200/70 pt-5">
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
            {notice.text}
          </p>
        )}
        <button type="button" onClick={save} disabled={isLoading || isSaving} className={ADMIN_PRIMARY_BUTTON}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? t.saving : t.save}
        </button>
      </div>
    </section>
  );
}
