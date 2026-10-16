import { useEffect, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Download, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useCurrency } from '../../../lib/currencyContext';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';
import { downloadGiftCardsPDF } from '../../../lib/giftCardPdfGenerator';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON } from '../adminUi';
import CalendarModal from './CalendarModal';

const MIN_AMOUNT_CENTS = 100;
const MAX_AMOUNT_CENTS = 100_000;
const DEFAULT_AMOUNTS_CENTS = [2500, 5000, 7000, 10000];

const TEXT: Translations<{
  title: string; close: string; what: string; amount: string; otherAmount: string; sets: string; passes: string; visits: string;
  paid: string; cash: string; card: string; buyer: string; buyerName: string; buyerEmail: string; optional: string;
  sell: string; selling: string; chooseFirst: string; failed: string; loadFailed: string;
  doneTitle: string; doneHint: string; print: string; done: string; another: string;
}> = {
  en: {
    title: 'Sell voucher', close: 'Close', what: 'What is sold?', amount: 'Value voucher', otherAmount: 'Other amount (€)', sets: 'Voucher sets', passes: 'Multi-visit cards', visits: '{count} visits',
    paid: 'How was it paid?', cash: 'Cash', card: 'Card', buyer: 'Buyer', buyerName: 'Name', buyerEmail: 'Email', optional: 'optional',
    sell: 'Sold – issue voucher', selling: 'Issuing…', chooseFirst: 'Choose what is sold and how it was paid.', failed: 'Could not issue the voucher. Please try again.', loadFailed: 'Could not load the vouchers.',
    doneTitle: 'Voucher issued', doneHint: 'Paid and active. It is in the cash book and in the voucher list.', print: 'Print / download PDF', done: 'Done', another: 'Sell another',
  },
  de: {
    title: 'Gutschein verkaufen', close: 'Schließen', what: 'Was wird verkauft?', amount: 'Wertgutschein', otherAmount: 'Anderer Betrag (€)', sets: 'Gutschein-Sets', passes: 'Mehrfachkarten', visits: '{count} Besuche',
    paid: 'Wie wurde bezahlt?', cash: 'Bar', card: 'Karte', buyer: 'Käufer:in', buyerName: 'Name', buyerEmail: 'E-Mail', optional: 'optional',
    sell: 'Verkauft – Gutschein ausstellen', selling: 'Wird ausgestellt…', chooseFirst: 'Bitte auswählen, was verkauft wurde und wie bezahlt wurde.', failed: 'Gutschein konnte nicht ausgestellt werden. Bitte erneut versuchen.', loadFailed: 'Gutscheine konnten nicht geladen werden.',
    doneTitle: 'Gutschein ausgestellt', doneHint: 'Bezahlt und gültig. Steht im Kassenbuch und in der Gutscheinliste.', print: 'Drucken / PDF laden', done: 'Fertig', another: 'Noch einen verkaufen',
  },
  th: {
    title: 'ขายบัตรของขวัญ', close: 'ปิด', what: 'ขายอะไร?', amount: 'บัตรมูลค่า', otherAmount: 'จำนวนเงินอื่น (€)', sets: 'ชุดบัตรของขวัญ', passes: 'บัตรหลายครั้ง', visits: '{count} ครั้ง',
    paid: 'ชำระด้วยอะไร?', cash: 'เงินสด', card: 'บัตร', buyer: 'ผู้ซื้อ', buyerName: 'ชื่อ', buyerEmail: 'อีเมล', optional: 'ไม่บังคับ',
    sell: 'ขายแล้ว – ออกบัตร', selling: 'กำลังออกบัตร…', chooseFirst: 'กรุณาเลือกสิ่งที่ขายและวิธีชำระเงิน', failed: 'ออกบัตรไม่สำเร็จ กรุณาลองอีกครั้ง', loadFailed: 'โหลดบัตรของขวัญไม่สำเร็จ',
    doneTitle: 'ออกบัตรแล้ว', doneHint: 'ชำระแล้วและใช้งานได้ บันทึกในสมุดเงินสดและรายการบัตรแล้ว', print: 'พิมพ์ / ดาวน์โหลด PDF', done: 'เสร็จ', another: 'ขายอีกใบ',
  },
};

type Choice = { kind: 'value'; cents: number } | { kind: 'set'; id: string } | { kind: 'pass'; id: string };
interface Offer { id: string; name: string; price_cents: number; visit_count?: number }
interface SoldCard { id: string; code: string; type: 'value' | 'service_pass'; value_cents: number; visits: number | null; name: string | null }
interface Sale { order_number: string; title: string; total_cents: number; bonus_note: string | null; cards: SoldCard[] }
interface PdfSettings { design_url: string | null; terms_and_conditions: string | null; expiry_days: number | null }

interface SellVoucherModalProps {
  businessId: string;
  onClose: () => void;
}

/** Counter sale in one popup: choose → paid how → issued (codes + PDF). */
export default function SellVoucherModal({ businessId, onClose }: SellVoucherModalProps) {
  const { t, lang } = useAdminText(TEXT);
  const { formatPrice, currency, currencySymbol } = useCurrency();
  const [amounts, setAmounts] = useState<number[]>(DEFAULT_AMOUNTS_CENTS);
  const [sets, setSets] = useState<Offer[]>([]);
  const [passes, setPasses] = useState<Offer[]>([]);
  const [pdfSettings, setPdfSettings] = useState<PdfSettings | null>(null);
  const [shopName, setShopName] = useState('');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [otherAmount, setOtherAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card' | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [isSelling, setIsSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      supabase.from('gift_card_settings').select('preset_amounts_cents, design_url, terms_and_conditions, expiry_days').eq('business_id', businessId).maybeSingle(),
      supabase.from('gift_card_packages').select('id, name, price_cents, valid_from, valid_until').eq('business_id', businessId).eq('is_active', true).order('display_order'),
      supabase.from('service_pass_offers').select('id, name, price_cents, visit_count').eq('business_id', businessId).eq('is_active', true).order('created_at'),
      supabase.from('businesses').select('name').eq('id', businessId).single(),
    ]).then(([settings, packages, offers, business]) => {
      if (settings.error || packages.error || offers.error) setError(t.loadFailed);
      const presets = settings.data?.preset_amounts_cents as number[] | null;
      if (presets?.length) setAmounts(presets);
      setPdfSettings((settings.data as PdfSettings | null) ?? null);
      setSets(((packages.data ?? []) as (Offer & { valid_from: string | null; valid_until: string | null })[])
        .filter((p) => (!p.valid_from || p.valid_from <= now) && (!p.valid_until || p.valid_until > now)));
      setPasses((offers.data ?? []) as Offer[]);
      setShopName(business.data?.name ?? '');
    });
  }, [businessId, t.loadFailed]);

  const otherCents = Math.round(parseFloat(otherAmount.replace(',', '.')) * 100);
  const isOtherValid = Number.isFinite(otherCents) && otherCents >= MIN_AMOUNT_CENTS && otherCents <= MAX_AMOUNT_CENTS;
  const effectiveChoice: Choice | null = otherAmount.trim() ? (isOtherValid ? { kind: 'value', cents: otherCents } : null) : choice;

  const sell = async () => {
    if (!effectiveChoice || !method) { setError(t.chooseFirst); return; }
    setError(null);
    setIsSelling(true);
    const { data, error: sellError } = await supabase.rpc('sell_gift_card_at_counter', {
      p_package_id: effectiveChoice.kind === 'set' ? effectiveChoice.id : null,
      p_service_pass_offer_id: effectiveChoice.kind === 'pass' ? effectiveChoice.id : null,
      p_value_cents: effectiveChoice.kind === 'value' ? effectiveChoice.cents : null,
      p_method: method,
      p_buyer_name: buyerName.trim() || null,
      p_buyer_email: buyerEmail.trim() || null,
    });
    setIsSelling(false);
    if (sellError || !data) {
      console.error('Counter voucher sale failed:', sellError);
      setError(t.failed);
      return;
    }
    setSale(data as Sale);
  };

  const downloadPdf = async () => {
    if (!sale) return;
    const expiresAt = pdfSettings?.expiry_days ? new Date(Date.now() + pdfSettings.expiry_days * 86_400_000).toISOString() : null;
    await downloadGiftCardsPDF(sale.cards.map((card) => ({
      code: card.code,
      amount: card.value_cents / 100,
      cardType: card.type,
      servicePassName: card.name,
      visits: card.visits,
      designUrl: pdfSettings?.design_url ?? null,
      termsAndConditions: pdfSettings?.terms_and_conditions ?? null,
      businessName: shopName,
      expiresAt,
      currencySymbol,
      currencyCode: currency,
      language: lang === 'de' ? 'de' : 'en',
      note: sale.cards.length > 1 ? sale.title : null,
    })), `Gutschein-${sale.order_number}.pdf`);
  };

  const tile = (isActive: boolean) =>
    `rounded-2xl border px-4 py-3 text-left transition ${isActive ? 'border-[#1A1714] bg-[#1A1714] text-white' : 'border-stone-200 bg-white text-[#1A1714] hover:border-stone-400'}`;
  const isChosen = (c: Choice) => !otherAmount.trim() && JSON.stringify(choice) === JSON.stringify(c);

  if (sale) {
    return (
      <CalendarModal title={t.doneTitle} closeLabel={t.close} onClose={onClose}>
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <p className="text-sm text-stone-600">{t.doneHint}</p>
          <div className="space-y-2">
            {sale.cards.map((card) => (
              <div key={card.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <p className="font-mono text-2xl font-semibold tracking-widest text-[#1A1714]">{card.code}</p>
                <p className="text-sm text-stone-500">{card.type === 'service_pass' ? `${card.name ?? ''} · ${card.visits ?? 0}×` : formatPrice(card.value_cents)}</p>
              </div>
            ))}
          </div>
          {sale.bonus_note && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">🎁 {sale.bonus_note}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={downloadPdf} className={ADMIN_PRIMARY_BUTTON}><Download className="h-4 w-4" />{t.print}</button>
            <button type="button" onClick={() => { setSale(null); setChoice(null); setOtherAmount(''); setMethod(null); setBuyerName(''); setBuyerEmail(''); }} className={ADMIN_SECONDARY_BUTTON}>{t.another}</button>
            <button type="button" onClick={onClose} className={ADMIN_SECONDARY_BUTTON}>{t.done}</button>
          </div>
        </div>
      </CalendarModal>
    );
  }

  return (
    <CalendarModal title={t.title} closeLabel={t.close} onClose={onClose} maxWidthClass="max-w-xl">
      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.what}</h3>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{t.amount}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {amounts.map((cents) => (
              <button key={cents} type="button" onClick={() => { setChoice({ kind: 'value', cents }); setOtherAmount(''); }} className={`${tile(isChosen({ kind: 'value', cents }))} text-center text-lg font-semibold`}>
                {formatPrice(cents)}
              </button>
            ))}
          </div>
          <input inputMode="decimal" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} placeholder={t.otherAmount} className={`${ADMIN_INPUT} max-w-[220px]`} />
          {sets.length > 0 && (
            <>
              <p className="pt-1 text-xs font-medium uppercase tracking-wide text-stone-400">{t.sets}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {sets.map((set) => (
                  <button key={set.id} type="button" onClick={() => { setChoice({ kind: 'set', id: set.id }); setOtherAmount(''); }} className={tile(isChosen({ kind: 'set', id: set.id }))}>
                    <span className="block font-semibold">{set.name}</span><span className="text-sm opacity-75">{formatPrice(set.price_cents)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {passes.length > 0 && (
            <>
              <p className="pt-1 text-xs font-medium uppercase tracking-wide text-stone-400">{t.passes}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {passes.map((pass) => (
                  <button key={pass.id} type="button" onClick={() => { setChoice({ kind: 'pass', id: pass.id }); setOtherAmount(''); }} className={tile(isChosen({ kind: 'pass', id: pass.id }))}>
                    <span className="block font-semibold">{pass.name}</span><span className="text-sm opacity-75">{formatPrice(pass.price_cents)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.paid}</h3>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMethod('cash')} className={`${tile(method === 'cash')} flex items-center justify-center gap-2 py-4 font-semibold`}><Banknote className="h-5 w-5" />{t.cash}</button>
            <button type="button" onClick={() => setMethod('card')} className={`${tile(method === 'card')} flex items-center justify-center gap-2 py-4 font-semibold`}><CreditCard className="h-5 w-5" />{t.card}</button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-[#1A1714]">{t.buyer} <span className="font-normal text-stone-400">({t.optional})</span></h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder={t.buyerName} maxLength={120} className={ADMIN_INPUT} />
            <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder={t.buyerEmail} maxLength={254} className={ADMIN_INPUT} />
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button type="button" onClick={sell} disabled={isSelling || !effectiveChoice || !method} className={`${ADMIN_PRIMARY_BUTTON} w-full py-3.5 text-[15px]`}>
          {isSelling && <Loader2 className="h-4 w-4 animate-spin" />}{isSelling ? t.selling : t.sell}
        </button>
      </div>
    </CalendarModal>
  );
}
