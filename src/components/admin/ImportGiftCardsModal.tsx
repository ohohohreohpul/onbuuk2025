import { useEffect, useRef, useState } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileText, CreditCard, Ticket } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import {
  parseGiftCardCsv,
  toGiftCardInsert,
  type GiftCardImportRow,
  type ServicePassOffer,
} from './giftCardImport/parseGiftCardCsv';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

interface ImportGiftCardsModalProps {
  onClose: () => void;
  onImportComplete: () => void | Promise<void>;
  expiryDays: number | null;
}

interface ImportOutcome {
  row: GiftCardImportRow;
  code: string | null;
  error: string | null;
}

type Step = 'upload' | 'preview' | 'importing' | 'complete';

const PREVIEW_LIMIT = 20;

type ImportText = {
  errDuplicateCode: string; errPassIncomplete: string; errNotSaved: string; errNotSavedShort: string; errCodeGeneration: string;
  errNotCsv: string; errFileUnreadable: string;
  tplTitle: string; tplType: string; tplCode: string; tplValue: string; tplPass: string; tplVisits: string; tplRecipient: string;
  tplExpires: string; tplYourPasses: string; tplNoPasses: string; tplExamplePass: string;
  title: string; subtitle: string; close: string; downloadTemplate: string; templateHint: string; templateHintPasses: string;
  clickToUpload: string; orDrag: string; formatGuide: string;
  guideType: string; guideTypeValue: string; guideTypePass: string;
  guideCode: string; guideValue: string; guidePass: string; guideVisits: string; guideRecipient: string; guideExpires: string;
  guideExpiresDefault: string; yourPasses: string; noPassesYet: string;
  rowSkipped: string; rowsSkipped: string; andMore: string; readyToImport: string; moneyCard: string; moneyCards: string;
  servicePasses: string; codesToGenerate: string;
  colRow: string; colType: string; colCode: string; colValuePass: string; colRecipient: string; colExpires: string;
  badgePass: string; badgeMoney: string; auto: string; visitsLeftPaid: string; never: string;
  creating: string; percentComplete: string; importComplete: string; importProblems: string;
  createdOne: string; createdMany: string; notCreated: string; failedRow: string; failedRowCode: string; andMoreSeeFile: string;
  downloadResults: string; done: string; back: string; cancel: string; importOne: string; importMany: string;
};

const TEXT: Translations<ImportText> = {
  en: {
    errDuplicateCode: 'This code is already used by another gift card.',
    errPassIncomplete: 'The service pass details are incomplete.',
    errNotSaved: 'Could not be saved. Please try again.',
    errNotSavedShort: 'Could not be saved.',
    errCodeGeneration: 'Could not generate a code.',
    errNotCsv: 'Please choose a .csv file. In Excel or Numbers use "Export as CSV".',
    errFileUnreadable: 'The file could not be read. Please try again.',
    tplTitle: '# Gift card import template',
    tplType: '# type: "value" for a money gift card, "service_pass" for a visit pass (empty = value)',
    tplCode: '# code: leave empty to generate one, or use your own (4-40 letters, numbers, dashes; must be unique)',
    tplValue: '# value: money cards = balance in {currency}; service passes = price paid (empty = the pass price)',
    tplPass: '# pass: service passes only - the exact name of a Service Pass you created',
    tplVisits: '# visits: service passes only - visits left on the card (empty = all visits of the pass)',
    tplRecipient: '# recipient_email: optional',
    tplExpires: '# expires_at: optional, 2027-12-31 or 31.12.2027 (empty = your default expiry)',
    tplYourPasses: '# Your service passes: {names}',
    tplNoPasses: '# You have no service passes yet: create one under Service Passes to import passes.',
    tplExamplePass: '10-visit massage pass',
    title: 'Import Gift Cards',
    subtitle: 'Bulk create gift cards and service passes from a CSV file',
    close: 'Close',
    downloadTemplate: 'Download Template',
    templateHint: 'A ready-to-fill file with examples for money gift cards.',
    templateHintPasses: 'A ready-to-fill file with examples for money gift cards and your service passes.',
    clickToUpload: 'Click to upload CSV file',
    orDrag: 'or drag and drop it here',
    formatGuide: 'CSV Format Guide',
    guideType: '{value} for a money gift card, {pass} for a visit pass (empty = value)',
    guideTypeValue: 'value', guideTypePass: 'service_pass',
    guideCode: 'leave empty to generate a unique code',
    guideValue: 'money cards: balance in {currency}. Service passes: price paid (empty = pass price)',
    guidePass: 'service passes only: the exact name of your Service Pass',
    guideVisits: 'service passes only: visits left (empty = all visits)',
    guideRecipient: 'optional',
    guideExpires: 'optional, e.g. 2027-12-31 or 31.12.2027',
    guideExpiresDefault: " (empty = {days} days from today, or the pass's own expiry)",
    yourPasses: 'Your service passes: {names}',
    noPassesYet: 'You have no service passes yet. Create one under Service Passes to import passes.',
    rowSkipped: '1 row will be skipped', rowsSkipped: '{count} rows will be skipped',
    andMore: '… and {count} more',
    readyToImport: 'Ready to import', moneyCard: '1 money card', moneyCards: '{count} money cards',
    servicePasses: 'Service passes', codesToGenerate: 'Codes to generate',
    colRow: 'Row', colType: 'Type', colCode: 'Code', colValuePass: 'Value / Pass', colRecipient: 'Recipient', colExpires: 'Expires',
    badgePass: 'Pass', badgeMoney: 'Money', auto: 'Auto',
    visitsLeftPaid: '{left} of {total} visits left · paid {amount}', never: 'Never',
    creating: 'Creating gift cards…', percentComplete: '{percent}% complete',
    importComplete: 'Import complete', importProblems: 'Import finished with problems',
    createdOne: 'Created 1 card', createdMany: 'Created {count} cards', notCreated: ', {count} not created',
    failedRow: 'Row {row}: {error}', failedRowCode: 'Row {row} ({code}): {error}',
    andMoreSeeFile: '… and {count} more. See the results file.',
    downloadResults: 'Download results', done: 'Done', back: 'Back', cancel: 'Cancel',
    importOne: 'Import 1 card', importMany: 'Import {count} cards',
  },
  de: {
    errDuplicateCode: 'Dieser Code wird bereits von einem anderen Gutschein verwendet.',
    errPassIncomplete: 'Die Angaben zum Behandlungsgutschein sind unvollständig.',
    errNotSaved: 'Konnte nicht gespeichert werden. Bitte erneut versuchen.',
    errNotSavedShort: 'Konnte nicht gespeichert werden.',
    errCodeGeneration: 'Es konnte kein Code erzeugt werden.',
    errNotCsv: 'Bitte eine .csv-Datei wählen. In Excel oder Numbers „Als CSV exportieren“ verwenden.',
    errFileUnreadable: 'Die Datei konnte nicht gelesen werden. Bitte erneut versuchen.',
    tplTitle: '# Vorlage für den Gutschein-Import',
    tplType: '# type: "value" für einen Wertgutschein, "service_pass" für einen Behandlungsgutschein (leer = value)',
    tplCode: '# code: leer lassen, um einen Code zu erzeugen, oder eigenen verwenden (4-40 Buchstaben, Ziffern, Bindestriche; eindeutig)',
    tplValue: '# value: Wertgutscheine = Guthaben in {currency}; Behandlungsgutscheine = bezahlter Preis (leer = Preis der Karte)',
    tplPass: '# pass: nur Behandlungsgutscheine - der genaue Name eines angelegten Behandlungsgutscheins',
    tplVisits: '# visits: nur Behandlungsgutscheine - verbleibende Besuche (leer = alle Besuche der Karte)',
    tplRecipient: '# recipient_email: optional',
    tplExpires: '# expires_at: optional, 2027-12-31 oder 31.12.2027 (leer = Standard-Gültigkeit)',
    tplYourPasses: '# Ihre Behandlungsgutscheine: {names}',
    tplNoPasses: '# Noch keine Behandlungsgutscheine: Unter Behandlungsgutscheine eine anlegen, um Karten zu importieren.',
    tplExamplePass: '10er Karte Massage',
    title: 'Gutscheine importieren',
    subtitle: 'Gutscheine und Behandlungsgutscheine gesammelt aus einer CSV-Datei anlegen',
    close: 'Schließen',
    downloadTemplate: 'Vorlage herunterladen',
    templateHint: 'Eine ausfüllbare Datei mit Beispielen für Wertgutscheine.',
    templateHintPasses: 'Eine ausfüllbare Datei mit Beispielen für Wertgutscheine und Ihre Behandlungsgutscheine.',
    clickToUpload: 'Klicken, um eine CSV-Datei hochzuladen',
    orDrag: 'oder per Drag & Drop hier ablegen',
    formatGuide: 'Hinweise zum CSV-Format',
    guideType: '{value} für einen Wertgutschein, {pass} für einen Behandlungsgutschein (leer = value)',
    guideTypeValue: 'value', guideTypePass: 'service_pass',
    guideCode: 'leer lassen, um einen eindeutigen Code zu erzeugen',
    guideValue: 'Wertgutscheine: Guthaben in {currency}. Behandlungsgutscheine: bezahlter Preis (leer = Preis der Karte)',
    guidePass: 'nur Behandlungsgutscheine: der genaue Name Ihres Behandlungsgutscheins',
    guideVisits: 'nur Behandlungsgutscheine: verbleibende Besuche (leer = alle Besuche)',
    guideRecipient: 'optional',
    guideExpires: 'optional, z. B. 2027-12-31 oder 31.12.2027',
    guideExpiresDefault: ' (leer = {days} Tage ab heute bzw. die Gültigkeit der Karte)',
    yourPasses: 'Ihre Behandlungsgutscheine: {names}',
    noPassesYet: 'Noch keine Behandlungsgutscheine vorhanden. Unter Behandlungsgutscheine eine anlegen, um Karten zu importieren.',
    rowSkipped: '1 Zeile wird übersprungen', rowsSkipped: '{count} Zeilen werden übersprungen',
    andMore: '… und {count} weitere',
    readyToImport: 'Bereit zum Import', moneyCard: '1 Wertgutschein', moneyCards: '{count} Wertgutscheine',
    servicePasses: 'Behandlungsgutscheine', codesToGenerate: 'Zu erzeugende Codes',
    colRow: 'Zeile', colType: 'Art', colCode: 'Code', colValuePass: 'Wert / Karte', colRecipient: 'Empfänger', colExpires: 'Gültig bis',
    badgePass: 'Karte', badgeMoney: 'Wert', auto: 'Automatisch',
    visitsLeftPaid: '{left} von {total} Besuchen übrig · bezahlt {amount}', never: 'Unbegrenzt',
    creating: 'Gutscheine werden angelegt…', percentComplete: '{percent} % abgeschlossen',
    importComplete: 'Import abgeschlossen', importProblems: 'Import mit Problemen abgeschlossen',
    createdOne: '1 Gutschein angelegt', createdMany: '{count} Gutscheine angelegt', notCreated: ', {count} nicht angelegt',
    failedRow: 'Zeile {row}: {error}', failedRowCode: 'Zeile {row} ({code}): {error}',
    andMoreSeeFile: '… und {count} weitere. Siehe Ergebnisdatei.',
    downloadResults: 'Ergebnisse herunterladen', done: 'Fertig', back: 'Zurück', cancel: 'Abbrechen',
    importOne: '1 Gutschein importieren', importMany: '{count} Gutscheine importieren',
  },
  th: {
    errDuplicateCode: 'โค้ดนี้ถูกใช้กับบัตรของขวัญใบอื่นแล้ว',
    errPassIncomplete: 'ข้อมูลบัตรบริการไม่ครบถ้วน',
    errNotSaved: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    errNotSavedShort: 'บันทึกไม่สำเร็จ',
    errCodeGeneration: 'สร้างโค้ดไม่สำเร็จ',
    errNotCsv: 'กรุณาเลือกไฟล์ .csv ใน Excel หรือ Numbers ให้ใช้ "ส่งออกเป็น CSV"',
    errFileUnreadable: 'อ่านไฟล์ไม่ได้ กรุณาลองอีกครั้ง',
    tplTitle: '# แม่แบบนำเข้าบัตรของขวัญ',
    tplType: '# type: "value" สำหรับบัตรของขวัญแบบมูลค่า, "service_pass" สำหรับบัตรบริการ (ว่าง = value)',
    tplCode: '# code: เว้นว่างเพื่อสร้างอัตโนมัติ หรือใช้โค้ดของคุณเอง (ตัวอักษร ตัวเลข ขีด 4-40 ตัว; ห้ามซ้ำ)',
    tplValue: '# value: บัตรมูลค่า = ยอดคงเหลือเป็น {currency}; บัตรบริการ = ราคาที่จ่าย (ว่าง = ราคาของแพ็กเกจ)',
    tplPass: '# pass: เฉพาะบัตรบริการ - ชื่อบัตรบริการที่สร้างไว้ให้ตรงทุกตัวอักษร',
    tplVisits: '# visits: เฉพาะบัตรบริการ - จำนวนครั้งที่เหลือ (ว่าง = ครบทุกครั้งของแพ็กเกจ)',
    tplRecipient: '# recipient_email: ไม่บังคับ',
    tplExpires: '# expires_at: ไม่บังคับ, 2027-12-31 หรือ 31.12.2027 (ว่าง = วันหมดอายุตามค่าเริ่มต้น)',
    tplYourPasses: '# บัตรบริการของคุณ: {names}',
    tplNoPasses: '# ยังไม่มีบัตรบริการ: สร้างที่เมนูบัตรบริการก่อนนำเข้า',
    tplExamplePass: 'บัตรนวด 10 ครั้ง',
    title: 'นำเข้าบัตรของขวัญ',
    subtitle: 'สร้างบัตรของขวัญและบัตรบริการหลายใบจากไฟล์ CSV',
    close: 'ปิด',
    downloadTemplate: 'ดาวน์โหลดแม่แบบ',
    templateHint: 'ไฟล์พร้อมกรอก มีตัวอย่างบัตรของขวัญแบบมูลค่า',
    templateHintPasses: 'ไฟล์พร้อมกรอก มีตัวอย่างบัตรของขวัญแบบมูลค่าและบัตรบริการของคุณ',
    clickToUpload: 'คลิกเพื่ออัปโหลดไฟล์ CSV',
    orDrag: 'หรือลากไฟล์มาวางที่นี่',
    formatGuide: 'คำแนะนำรูปแบบ CSV',
    guideType: '{value} สำหรับบัตรของขวัญแบบมูลค่า, {pass} สำหรับบัตรบริการ (ว่าง = value)',
    guideTypeValue: 'value', guideTypePass: 'service_pass',
    guideCode: 'เว้นว่างเพื่อสร้างโค้ดที่ไม่ซ้ำโดยอัตโนมัติ',
    guideValue: 'บัตรมูลค่า: ยอดคงเหลือเป็น {currency} บัตรบริการ: ราคาที่จ่าย (ว่าง = ราคาของแพ็กเกจ)',
    guidePass: 'เฉพาะบัตรบริการ: ชื่อบัตรบริการให้ตรงทุกตัวอักษร',
    guideVisits: 'เฉพาะบัตรบริการ: จำนวนครั้งที่เหลือ (ว่าง = ครบทุกครั้ง)',
    guideRecipient: 'ไม่บังคับ',
    guideExpires: 'ไม่บังคับ เช่น 2027-12-31 หรือ 31.12.2027',
    guideExpiresDefault: ' (ว่าง = {days} วันนับจากวันนี้ หรือวันหมดอายุของแพ็กเกจ)',
    yourPasses: 'บัตรบริการของคุณ: {names}',
    noPassesYet: 'ยังไม่มีบัตรบริการ สร้างที่เมนูบัตรบริการก่อนนำเข้า',
    rowSkipped: 'จะข้าม 1 แถว', rowsSkipped: 'จะข้าม {count} แถว',
    andMore: '… และอีก {count} รายการ',
    readyToImport: 'พร้อมนำเข้า', moneyCard: 'บัตรมูลค่า 1 ใบ', moneyCards: 'บัตรมูลค่า {count} ใบ',
    servicePasses: 'บัตรบริการ', codesToGenerate: 'โค้ดที่จะสร้าง',
    colRow: 'แถว', colType: 'ประเภท', colCode: 'โค้ด', colValuePass: 'มูลค่า / แพ็กเกจ', colRecipient: 'ผู้รับ', colExpires: 'หมดอายุ',
    badgePass: 'แพ็กเกจ', badgeMoney: 'มูลค่า', auto: 'อัตโนมัติ',
    visitsLeftPaid: 'เหลือ {left} จาก {total} ครั้ง · จ่าย {amount}', never: 'ไม่มีวันหมดอายุ',
    creating: 'กำลังสร้างบัตรของขวัญ…', percentComplete: 'เสร็จแล้ว {percent}%',
    importComplete: 'นำเข้าเสร็จสิ้น', importProblems: 'นำเข้าเสร็จแต่มีปัญหา',
    createdOne: 'สร้างแล้ว 1 ใบ', createdMany: 'สร้างแล้ว {count} ใบ', notCreated: ', สร้างไม่สำเร็จ {count} ใบ',
    failedRow: 'แถว {row}: {error}', failedRowCode: 'แถว {row} ({code}): {error}',
    andMoreSeeFile: '… และอีก {count} รายการ ดูในไฟล์ผลลัพธ์',
    downloadResults: 'ดาวน์โหลดผลลัพธ์', done: 'เสร็จสิ้น', back: 'ย้อนกลับ', cancel: 'ยกเลิก',
    importOne: 'นำเข้า 1 ใบ', importMany: 'นำเข้า {count} ใบ',
  },
};

const friendlyInsertError = (message: string, t: ImportText) =>
  message.includes('gift_cards_code_key') || message.includes('duplicate key')
    ? t.errDuplicateCode
    : message.includes('service_pass')
      ? t.errPassIncomplete
      : t.errNotSaved;

const downloadCsv = (filename: string, lines: string[]) => {
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const csvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function ImportGiftCardsModal({ onClose, onImportComplete, expiryDays }: ImportGiftCardsModalProps) {
  const { businessId } = useTenant();
  const { currency, formatAmount } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const [step, setStep] = useState<Step>('upload');
  const [offers, setOffers] = useState<ServicePassOffer[]>([]);
  const [rows, setRows] = useState<GiftCardImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!businessId) return;
    supabase
      .from('service_pass_offers')
      .select('id, name, service_id, duration_id, visit_count, price_cents, expiry_days, is_active')
      .eq('business_id', businessId)
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('Could not load service passes:', error);
        setOffers((data || []) as ServicePassOffer[]);
      });
  }, [businessId]);

  const activeOffers = offers.filter((offer) => offer.is_active);
  const exampleOffer = activeOffers[0];

  const downloadTemplate = () => {
    const passName = exampleOffer?.name ?? t.tplExamplePass;
    const passVisits = exampleOffer?.visit_count ?? 10;
    downloadCsv('gift_cards_import_template.csv', [
      t.tplTitle,
      t.tplType,
      t.tplCode,
      fillText(t.tplValue, { currency }),
      t.tplPass,
      t.tplVisits,
      t.tplRecipient,
      t.tplExpires,
      activeOffers.length > 0
        ? fillText(t.tplYourPasses, { names: activeOffers.map((offer) => offer.name).join(' | ') })
        : t.tplNoPasses,
      'type,code,value,pass,visits,recipient_email,expires_at',
      'value,,50.00,,,customer@example.com,',
      'value,GC-CUSTOM-CODE,100.00,,,,2027-12-31',
      `service_pass,,,${csvCell(passName)},${passVisits},regular@example.com,`,
      `service_pass,,,${csvCell(passName)},3,,`,
    ]);
  };

  const readFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors([t.errNotCsv]);
      setRows([]);
      setStep('preview');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = parseGiftCardCsv(String(event.target?.result ?? ''), { offers, defaultExpiryDays: expiryDays });
      setRows(result.rows);
      setErrors(result.errors);
      setStep('preview');
    };
    reader.onerror = () => {
      setErrors([t.errFileUnreadable]);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) readFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const handleImport = async () => {
    if (!businessId || rows.length === 0) return;
    setStep('importing');
    setImportProgress(0);

    const results: ImportOutcome[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        let code = row.code;
        if (!code) {
          const { data: generated, error: codeError } = await supabase.rpc('generate_gift_card_code', { p_business_id: businessId });
          if (codeError || !generated) throw new Error(t.errCodeGeneration);
          code = generated as string;
        }

        const { error: insertError } = await supabase.from('gift_cards').insert(toGiftCardInsert(row, businessId, code));
        if (insertError) {
          console.error(`Gift card import row ${row.rowNumber} failed:`, insertError);
          results.push({ row, code, error: friendlyInsertError(insertError.message, t) });
        } else {
          results.push({ row, code, error: null });
        }
      } catch (error) {
        console.error(`Gift card import row ${row.rowNumber} failed:`, error);
        results.push({ row, code: row.code, error: error instanceof Error ? error.message : t.errNotSavedShort });
      } finally {
        setImportProgress(Math.round(((i + 1) / rows.length) * 100));
      }
    }

    setOutcomes(results);
    setStep('complete');
  };

  const downloadResults = () => {
    downloadCsv(`gift_card_import_results_${new Date().toISOString().slice(0, 10)}.csv`, [
      'row,result,type,code,value,pass,visits,recipient_email,expires_at,reason',
      ...outcomes.map(({ row, code, error }) =>
        [
          row.rowNumber,
          error ? 'failed' : 'imported',
          row.type,
          code,
          ((row.type === 'value' ? row.valueCents : row.pricePaidCents) / 100).toFixed(2),
          row.type === 'service_pass' ? row.offer.name : '',
          row.type === 'service_pass' ? row.visitsLeft : '',
          row.recipientEmail,
          row.expiresAt ? row.expiresAt.slice(0, 10) : '',
          error,
        ]
          .map(csvCell)
          .join(',')
      ),
    ]);
  };

  const valueRows = rows.filter((row) => row.type === 'value');
  const passRows = rows.filter((row) => row.type === 'service_pass');
  const totalValueCents = valueRows.reduce((sum, row) => sum + (row.type === 'value' ? row.valueCents : 0), 0);
  const succeeded = outcomes.filter((outcome) => !outcome.error).length;
  const failed = outcomes.filter((outcome) => outcome.error);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-[#1A1714]" />
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">{t.title}</h2>
              <p className="text-gray-600 mt-1">{t.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t.close} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-stone-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{t.downloadTemplate}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {activeOffers.length > 0 ? t.templateHintPasses : t.templateHint}
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t.downloadTemplate}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-[#1A1714] bg-stone-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">{t.clickToUpload}</p>
                <p className="text-sm text-gray-500 mt-2">{t.orDrag}</p>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{t.formatGuide}</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>type:</strong> {fillText(t.guideType, { value: t.guideTypeValue, pass: t.guideTypePass })}</li>
                  <li>• <strong>code:</strong> {t.guideCode}</li>
                  <li>• <strong>value:</strong> {fillText(t.guideValue, { currency })}</li>
                  <li>• <strong>pass:</strong> {t.guidePass}</li>
                  <li>• <strong>visits:</strong> {t.guideVisits}</li>
                  <li>• <strong>recipient_email:</strong> {t.guideRecipient}</li>
                  <li>
                    • <strong>expires_at:</strong> {t.guideExpires}
                    {expiryDays ? fillText(t.guideExpiresDefault, { days: expiryDays }) : ''}
                  </li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                  {activeOffers.length > 0
                    ? fillText(t.yourPasses, { names: activeOffers.map((offer) => offer.name).join(', ') })
                    : t.noPassesYet}
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-red-900">
                        {errors.length === 1 ? t.rowSkipped : fillText(t.rowsSkipped, { count: errors.length })}
                      </h3>
                      <ul className="text-sm text-red-700 mt-2 space-y-1">
                        {errors.slice(0, 50).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                      {errors.length > 50 && <p className="text-sm text-red-700 mt-1">{fillText(t.andMore, { count: errors.length - 50 })}</p>}
                    </div>
                  </div>
                </div>
              )}

              {rows.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
                      <p className="text-sm text-gray-600">{t.readyToImport}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{formatAmount(totalValueCents / 100)}</p>
                      <p className="text-sm text-gray-600">{valueRows.length === 1 ? t.moneyCard : fillText(t.moneyCards, { count: valueRows.length })}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{passRows.length}</p>
                      <p className="text-sm text-gray-600">{t.servicePasses}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{rows.filter((row) => !row.code).length}</p>
                      <p className="text-sm text-gray-600">{t.codesToGenerate}</p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {[t.colRow, t.colType, t.colCode, t.colValuePass, t.colRecipient, t.colExpires].map((heading) => (
                            <th key={heading} className="px-4 py-3 text-left font-medium text-gray-700">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {rows.slice(0, PREVIEW_LIMIT).map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-400">{row.rowNumber}</td>
                            <td className="px-4 py-3">
                              {row.type === 'service_pass' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  <Ticket className="h-3 w-3" /> {t.badgePass}
                                </span>
                              ) : (
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">{t.badgeMoney}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-900">
                              {row.code || <span className="text-gray-400 italic font-sans">{t.auto}</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {row.type === 'value' ? (
                                <span className="font-medium">{formatAmount(row.valueCents / 100)}</span>
                              ) : (
                                <span>
                                  <span className="font-medium">{row.offer.name}</span>
                                  <span className="block text-xs text-gray-500">
                                    {fillText(t.visitsLeftPaid, { left: row.visitsLeft, total: row.visitsTotal, amount: formatAmount(row.pricePaidCents / 100) })}
                                  </span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{row.recipientEmail || '–'}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString(locale) : t.never}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > PREVIEW_LIMIT && (
                      <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 text-center">
                        {fillText(t.andMore, { count: rows.length - PREVIEW_LIMIT })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-[#1A1714] rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-lg font-medium text-gray-900">{t.creating}</p>
              <div className="mt-4 w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                <div className="bg-[#1A1714] h-2 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{fillText(t.percentComplete, { percent: importProgress })}</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="py-10">
              <div className="text-center">
                {failed.length === 0 ? (
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
                ) : (
                  <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-6" />
                )}
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {failed.length === 0 ? t.importComplete : t.importProblems}
                </h3>
                <p className="text-gray-600 mb-6">
                  {succeeded === 1 ? t.createdOne : fillText(t.createdMany, { count: succeeded })}
                  {failed.length > 0 && <span className="text-red-600">{fillText(t.notCreated, { count: failed.length })}</span>}.
                </p>
              </div>

              {failed.length > 0 && (
                <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <ul className="space-y-1">
                    {failed.slice(0, 20).map(({ row, code, error }) => (
                      <li key={row.rowNumber}>• {fillText(code ? t.failedRowCode : t.failedRow, { row: row.rowNumber, code: code ?? '', error: error ?? '' })}</li>
                    ))}
                  </ul>
                  {failed.length > 20 && <p className="mt-1">{fillText(t.andMoreSeeFile, { count: failed.length - 20 })}</p>}
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={downloadResults}
                  className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.downloadResults}</span>
                </button>
                <button
                  onClick={async () => {
                    await onImportComplete();
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors"
                >
                  {t.done}
                </button>
              </div>
            </div>
          )}
        </div>

        {(step === 'upload' || step === 'preview') && (
          <div className="p-6 border-t border-gray-200 flex justify-between">
            <button
              onClick={() => (step === 'preview' ? setStep('upload') : onClose())}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {step === 'preview' ? t.back : t.cancel}
            </button>
            {step === 'preview' && rows.length > 0 && (
              <button
                onClick={handleImport}
                className="px-6 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors"
              >
                {rows.length === 1 ? t.importOne : fillText(t.importMany, { count: rows.length })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
