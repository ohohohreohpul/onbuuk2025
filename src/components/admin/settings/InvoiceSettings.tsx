import { useEffect, useState } from 'react';
import { Receipt, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SELECT } from '../adminUi';
import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  loadFailed: string; prefixInvalid: string; taxIdRequired: string; saveFailed: string; saved: string; title: string;
  intro: string; legalName: string; prefix: string; taxNumber: string; vatId: string; smallBusiness: string;
  smallBusinessHelp: string; vatRate: string; vatStandard: string; vatReduced: string; footer: string; saving: string; save: string;
}> = {
  en: {
    loadFailed: 'Could not load the invoice settings.', prefixInvalid: 'Prefix: 1–10 letters, digits or dashes.',
    taxIdRequired: 'German invoices need a Steuernummer or a USt-IdNr.', saveFailed: 'Could not save. Please try again.',
    saved: 'Invoice settings saved.', title: 'Invoices',
    intro: 'Printed on every invoice (Bookings › ⋯ › Invoice). Numbers run per year without gaps, e.g. RE-2026-0001; an issued invoice never changes.',
    legalName: 'Legal business name', prefix: 'Invoice number prefix', taxNumber: 'Steuernummer', vatId: 'USt-IdNr. (if you have one)',
    smallBusiness: 'Kleinunternehmer (§ 19 UStG)', smallBusinessHelp: 'No VAT on invoices; the § 19 note is printed instead.',
    vatRate: 'VAT rate on treatments', vatStandard: '19 % (standard)', vatReduced: '7 % (reduced)',
    footer: 'Footer (bank details, owner, register)', saving: 'Saving…', save: 'Save',
  },
  de: {
    loadFailed: 'Rechnungseinstellungen konnten nicht geladen werden.', prefixInvalid: 'Präfix: 1–10 Buchstaben, Ziffern oder Bindestriche.',
    taxIdRequired: 'Deutsche Rechnungen brauchen eine Steuernummer oder eine USt-IdNr.', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    saved: 'Rechnungseinstellungen gespeichert.', title: 'Rechnungen',
    intro: 'Steht auf jeder Rechnung (Buchungen › ⋯ › Rechnung). Die Nummern laufen pro Jahr lückenlos, z. B. RE-2026-0001; eine ausgestellte Rechnung wird nie geändert.',
    legalName: 'Offizieller Firmenname', prefix: 'Präfix der Rechnungsnummer', taxNumber: 'Steuernummer', vatId: 'USt-IdNr. (falls vorhanden)',
    smallBusiness: 'Kleinunternehmer (§ 19 UStG)', smallBusinessHelp: 'Keine Umsatzsteuer auf Rechnungen; stattdessen wird der Hinweis nach § 19 gedruckt.',
    vatRate: 'Umsatzsteuersatz auf Behandlungen', vatStandard: '19 % (Regelsatz)', vatReduced: '7 % (ermäßigt)',
    footer: 'Fußzeile (Bankverbindung, Inhaber, Register)', saving: 'Wird gespeichert…', save: 'Speichern',
  },
  th: {
    loadFailed: 'โหลดการตั้งค่าใบแจ้งหนี้ไม่สำเร็จ', prefixInvalid: 'คำนำหน้า: ตัวอักษร ตัวเลข หรือขีด 1–10 ตัว',
    taxIdRequired: 'ใบแจ้งหนี้ในเยอรมนีต้องมีเลขประจำตัวผู้เสียภาษี (Steuernummer) หรือเลขภาษีมูลค่าเพิ่ม (USt-IdNr.)', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    saved: 'บันทึกการตั้งค่าใบแจ้งหนี้แล้ว', title: 'ใบแจ้งหนี้',
    intro: 'พิมพ์บนใบแจ้งหนี้ทุกใบ (การจอง › ⋯ › ใบแจ้งหนี้) เลขที่เรียงต่อเนื่องรายปีไม่มีช่องว่าง เช่น RE-2026-0001 และใบแจ้งหนี้ที่ออกแล้วจะไม่ถูกแก้ไข',
    legalName: 'ชื่อธุรกิจตามกฎหมาย', prefix: 'คำนำหน้าเลขที่ใบแจ้งหนี้', taxNumber: 'เลขประจำตัวผู้เสียภาษี (Steuernummer)', vatId: 'เลขภาษีมูลค่าเพิ่ม (USt-IdNr.) (ถ้ามี)',
    smallBusiness: 'ผู้ประกอบการรายย่อย (Kleinunternehmer, § 19 UStG)', smallBusinessHelp: 'ไม่มีภาษีมูลค่าเพิ่มในใบแจ้งหนี้ จะพิมพ์หมายเหตุตาม § 19 แทน',
    vatRate: 'อัตราภาษีมูลค่าเพิ่มสำหรับบริการ', vatStandard: '19 % (อัตรามาตรฐาน)', vatReduced: '7 % (อัตราลดหย่อน)',
    footer: 'ท้ายกระดาษ (บัญชีธนาคาร, เจ้าของ, ทะเบียน)', saving: 'กำลังบันทึก…', save: 'บันทึก',
  },
};

type NoticeKey = 'loadFailed' | 'prefixInvalid' | 'taxIdRequired' | 'saveFailed' | 'saved';

interface InvoiceData {
  legal_name: string | null;
  tax_number: string | null;
  vat_id: string | null;
  is_small_business: boolean;
  default_vat_bps: number;
  invoice_prefix: string;
  invoice_footer: string | null;
}

const EMPTY: InvoiceData = {
  legal_name: '', tax_number: '', vat_id: '', is_small_business: false, default_vat_bps: 1900, invoice_prefix: 'RE', invoice_footer: '',
};
const PREFIX = /^[A-Za-z0-9-]{1,10}$/;

/** Tax data printed on invoices (§14 UStG). Invoices are issued per booking. */
export default function InvoiceSettings() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const [data, setData] = useState<InvoiceData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; key: NoticeKey } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('businesses')
      .select('legal_name, tax_number, vat_id, is_small_business, default_vat_bps, invoice_prefix, invoice_footer')
      .eq('id', businessId)
      .maybeSingle<InvoiceData>()
      .then(({ data: row, error }) => {
        if (error) {
          console.error('Could not load invoice settings:', error);
          setNotice({ tone: 'error', key: 'loadFailed' });
        }
        if (row) setData({ ...EMPTY, ...row });
        setIsLoading(false);
      });
  }, [businessId]);

  const set = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => setData((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!businessId) return;
    if (!PREFIX.test(data.invoice_prefix)) {
      setNotice({ tone: 'error', key: 'prefixInvalid' });
      return;
    }
    if (!data.tax_number?.trim() && !data.vat_id?.trim()) {
      setNotice({ tone: 'error', key: 'taxIdRequired' });
      return;
    }
    setIsSaving(true);
    setNotice(null);
    const blank = (value: string | null) => value?.trim() || null;
    const { error } = await supabase.from('businesses').update({
      legal_name: blank(data.legal_name),
      tax_number: blank(data.tax_number),
      vat_id: blank(data.vat_id),
      is_small_business: data.is_small_business,
      default_vat_bps: data.is_small_business ? 0 : data.default_vat_bps,
      invoice_prefix: data.invoice_prefix.trim(),
      invoice_footer: blank(data.invoice_footer),
    }).eq('id', businessId);
    setIsSaving(false);
    setNotice(error ? { tone: 'error', key: 'saveFailed' } : { tone: 'success', key: 'saved' });
    if (error) console.error('Could not save invoice settings:', error);
  };

  const text = (key: 'legal_name' | 'tax_number' | 'vat_id' | 'invoice_prefix', label: string, placeholder: string) => (
    <label htmlFor={`invoice-${key}`} className="block text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      <input id={`invoice-${key}`} className={`${ADMIN_INPUT} mt-1`} value={data[key] ?? ''} placeholder={placeholder} disabled={isLoading}
        onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Receipt className="mt-0.5 h-5 w-5 text-stone-600" aria-hidden="true" />
        <div>
          <h3 className="text-lg font-medium text-stone-900">{t.title}</h3>
          <p className="text-sm text-stone-500">
            {t.intro}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {text('legal_name', t.legalName, 'SATUUU99 Wellness – Inh. Max Muster')}
        {text('invoice_prefix', t.prefix, 'RE')}
        {text('tax_number', t.taxNumber, '30/123/45678')}
        {text('vat_id', t.vatId, 'DE123456789')}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-stone-50 px-4 py-3">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1A1714]" checked={data.is_small_business} disabled={isLoading}
          onChange={(e) => set('is_small_business', e.target.checked)} />
        <span>
          <span className="block text-sm font-medium text-stone-800">{t.smallBusiness}</span>
          <span className="block text-xs text-stone-500">{t.smallBusinessHelp}</span>
        </span>
      </label>

      {!data.is_small_business && (
        <label htmlFor="invoice-vat" className="block text-sm sm:w-1/2">
          <span className="font-medium text-stone-700">{t.vatRate}</span>
          <select id="invoice-vat" className={`${ADMIN_SELECT} mt-1`} value={data.default_vat_bps} disabled={isLoading}
            onChange={(e) => set('default_vat_bps', Number(e.target.value))}>
            <option value={1900}>{t.vatStandard}</option>
            <option value={700}>{t.vatReduced}</option>
          </select>
        </label>
      )}

      <label htmlFor="invoice-footer" className="block text-sm">
        <span className="font-medium text-stone-700">{t.footer}</span>
        <textarea id="invoice-footer" rows={3} className={`${ADMIN_INPUT} mt-1`} value={data.invoice_footer ?? ''} disabled={isLoading}
          placeholder="Bankverbindung: IBAN DE.. · Inhaber: .." onChange={(e) => set('invoice_footer', e.target.value)} />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{t[notice.key]}</p>}
        <button type="button" className={ADMIN_PRIMARY_BUTTON} onClick={save} disabled={isLoading || isSaving}>
          <Save className="h-4 w-4" aria-hidden="true" /> {isSaving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
