import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Download,
  FileText,
  Plus,
  Upload,
  Wallet,
  Building2,
  Receipt,
  Percent,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminAuth } from '../../lib/adminAuth';
import { useCurrency } from '../../lib/currencyContext';
import { toLocalDateString } from '../../lib/localDateTime';
import BookingPaymentsReport from './bookings/BookingPaymentsReport';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';

interface CashEntry {
  id: string;
  entry_date: string;
  entry_time: string | null;
  description: string;
  source: string;
  payment_method: string;
  net_cents: number;
  vat_rate_bps: number;
  gross_cents: number;
  booking_id: string | null;
  import_batch_id: string | null;
  is_reversal?: boolean;
  reverses_entry_id?: string | null;
  booking_payment_id?: string | null;
}

type Tab = 'records' | 'payments' | 'reports' | 'import';

const SURFACE =
  'bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)]';
const ICON_TILE = 'w-10 h-10 rounded-xl bg-stone-900/[6%] flex items-center justify-center shrink-0';

type TaxText = {
  title: string; subtitle: string; addRecord: string; tabRecords: string; tabPayments: string; tabReports: string; tabImport: string;
  grossPeriod: string; vatCollected: string; vatBreakdown: string; recordsBySource: string;
  setupTitle: string; setupBefore: string; setupMiddle: string; setupAfter: string;
  cashBookEntries: string; colDate: string; colDescription: string; colSource: string; colMethod: string; colNet: string; colVat: string;
  colGross: string; noRecords: string; delete: string; confirmDelete: string; cancelled: string; cancelFailed: string;
  euerTitle: string; euerSubtitle: string; generateSummary: string; euerHint: string;
  datevTitle: string; datevSubtitle: string; downloadDatev: string; datevHint: string;
  defaultsTitle: string; defaultsSubtitle: string; defaultVat: string; cashAccount: string; revenueAccounts: string;
  rev19Title: string; rev7Title: string; revNoVatTitle: string; saveDefaults: string; defaultsSaved: string;
  documentsTitle: string; documentsSubtitle: string; colFile: string; colType: string; colPeriod: string; colCreated: string;
  noDocuments: string; typeDatev: string; typeEuer: string;
  importTitle: string; importSubtitle: string; dropFile: string; dropHint: string; mappingTitle: string; detectedSource: string;
  genericCsv: string; uploadToMap: string; fieldDate: string; fieldDescription: string; fieldAmount: string; fieldMethod: string;
  column: string; importRowsOne: string; importRowsMany: string; clear: string; historyTitle: string; colImported: string; colWhen: string;
  noImports: string; noRowsInFile: string; importFailed: string; importedRows: string;
  addEntryTitle: string; addEntrySubtitle: string; amountGross: string; descriptionPlaceholder: string; paymentMethod: string; vat: string;
  cancel: string; saveEntry: string;
  vat19: string; vat7: string; vat0: string;
  sourceManual: string; sourceBooking: string; sourceImport: string;
  methodCash: string; methodCard: string; methodOnline: string; methodGiftCard: string; methodOther: string;
};

const TEXT: Translations<TaxText> = {
  en: {
    title: 'Tax & Reports', subtitle: 'Kassenbuch, EÜR summaries, DATEV exports, and platform imports', addRecord: 'Add record',
    tabRecords: 'Records', tabPayments: 'Booking payments', tabReports: 'Reports & Documents', tabImport: 'Import',
    grossPeriod: 'Gross turnover (period)', vatCollected: 'VAT collected (19%/7%)', vatBreakdown: '{vat19} at 19% · {vat7} at 7% · {net} net',
    recordsBySource: '{count} records · by source',
    setupTitle: 'One-time database setup required', setupBefore: 'Create the', setupMiddle: 'tables by running the migration in',
    setupAfter: 'in your Supabase SQL editor, then reload this page.',
    cashBookEntries: 'Kassenbuch entries', colDate: 'Date', colDescription: 'Description', colSource: 'Source', colMethod: 'Method',
    colNet: 'Net', colVat: 'VAT', colGross: 'Gross', noRecords: 'No records in this period.', delete: 'Cancel entry', confirmDelete: 'Cancel this entry? It stays in the cash book and a minus line (“Storno”) is added, as tax law requires.', cancelled: 'Cancelled', cancelFailed: 'Could not cancel the entry.',
    euerTitle: 'EÜR-style summary', euerSubtitle: 'German income-surplus statement (printable / PDF)', generateSummary: 'Generate summary document',
    euerHint: 'Covers the EÜR line structure your tax adviser maps in Anlage EÜR. VAT split and payment-method totals are included.',
    datevTitle: 'DATEV Buchungsstapel', datevSubtitle: 'Semicolon CSV for the Steuerberater', downloadDatev: 'Download DATEV CSV',
    datevHint: 'EXTF_ filename, semicolon-separated, decimal comma, ISO-8859-1-safe. Map accounts in your tax software.',
    defaultsTitle: 'Tax defaults & account mapping', defaultsSubtitle: 'Defaults for new records and DATEV export', defaultVat: 'Default VAT rate',
    cashAccount: 'Kasse (cash account)', revenueAccounts: 'Revenue accounts (19% / 7% / no VAT)', rev19Title: '19% revenue', rev7Title: '7% revenue',
    revNoVatTitle: 'No VAT', saveDefaults: 'Save defaults', defaultsSaved: 'Tax defaults saved.',
    documentsTitle: 'Generated documents', documentsSubtitle: 'History of summaries and exports', colFile: 'File', colType: 'Type', colPeriod: 'Period',
    colCreated: 'Created', noDocuments: 'No documents yet.', typeDatev: 'DATEV export', typeEuer: 'EÜR summary',
    importTitle: 'Import revenue', importSubtitle: 'Treatwell Pro, Planity Pro, or any platform CSV', dropFile: 'Drop a CSV here or click to browse',
    dropHint: 'Treatwell "Sale Proceeds" and Planity monthly reports detected automatically', mappingTitle: 'Column mapping',
    detectedSource: 'Detected source:', genericCsv: 'Generic CSV', uploadToMap: 'Upload a file to map columns.',
    fieldDate: 'Date', fieldDescription: 'Description', fieldAmount: 'Amount', fieldMethod: 'Method', column: 'Column {number}',
    importRowsOne: 'Import {count} row', importRowsMany: 'Import {count} rows', clear: 'Clear', historyTitle: 'Import history',
    colImported: 'Imported', colWhen: 'When', noImports: 'No imports yet.', noRowsInFile: 'No rows detected in this file.',
    importFailed: 'Import batch failed', importedRows: 'Imported {count} rows ({skipped} skipped).',
    addEntryTitle: 'Add cash entry', addEntrySubtitle: 'Record a walk-in or cash sale.', amountGross: 'Amount (gross)',
    descriptionPlaceholder: 'Cut & Style — cash customer', paymentMethod: 'Payment method', vat: 'VAT', cancel: 'Cancel', saveEntry: 'Save entry',
    vat19: '19% — Standard rate', vat7: '7% — Reduced rate', vat0: 'No VAT — Kleinunternehmer (§19 UStG)',
    sourceManual: 'Manual', sourceBooking: 'Zenno booking', sourceImport: 'Import',
    methodCash: 'Cash', methodCard: 'Card', methodOnline: 'Online', methodGiftCard: 'Gift card', methodOther: 'Other',
  },
  de: {
    title: 'Steuern & Berichte', subtitle: 'Kassenbuch, EÜR-Übersichten, DATEV-Exporte und Plattform-Importe', addRecord: 'Eintrag hinzufügen',
    tabRecords: 'Einträge', tabPayments: 'Zahlungen aus Buchungen', tabReports: 'Berichte & Dokumente', tabImport: 'Importieren',
    grossPeriod: 'Bruttoumsatz (Zeitraum)', vatCollected: 'Vereinnahmte MwSt. (19 %/7 %)', vatBreakdown: '{vat19} zu 19 % · {vat7} zu 7 % · {net} netto',
    recordsBySource: '{count} Einträge · nach Quelle',
    setupTitle: 'Einmalige Datenbank-Einrichtung erforderlich', setupBefore: 'Legen Sie die Tabellen', setupMiddle: 'an, indem Sie die Migration',
    setupAfter: 'im Supabase-SQL-Editor ausführen, und laden Sie die Seite neu.',
    cashBookEntries: 'Kassenbuch-Einträge', colDate: 'Datum', colDescription: 'Beschreibung', colSource: 'Quelle', colMethod: 'Zahlart',
    colNet: 'Netto', colVat: 'MwSt.', colGross: 'Brutto', noRecords: 'Keine Einträge in diesem Zeitraum.', delete: 'Stornieren', confirmDelete: 'Eintrag stornieren? Er bleibt im Kassenbuch stehen, und eine Minus-Zeile („Storno“) wird ergänzt – so verlangt es das Finanzamt.', cancelled: 'Storniert', cancelFailed: 'Stornieren fehlgeschlagen.',
    euerTitle: 'EÜR-Übersicht', euerSubtitle: 'Einnahmen-Überschuss-Aufstellung (druckbar / PDF)', generateSummary: 'Übersicht erstellen',
    euerHint: 'Folgt der Zeilenstruktur, die Ihre Steuerberatung in die Anlage EÜR überträgt. MwSt.-Aufteilung und Summen je Zahlart sind enthalten.',
    datevTitle: 'DATEV Buchungsstapel', datevSubtitle: 'Semikolon-CSV für die Steuerberatung', downloadDatev: 'DATEV-CSV herunterladen',
    datevHint: 'EXTF_-Dateiname, Semikolon-getrennt, Dezimalkomma, ISO-8859-1-kompatibel. Konten in Ihrer Steuersoftware zuordnen.',
    defaultsTitle: 'Steuer-Standards & Kontenzuordnung', defaultsSubtitle: 'Standards für neue Einträge und den DATEV-Export', defaultVat: 'Standard-MwSt.-Satz',
    cashAccount: 'Kasse (Kassenkonto)', revenueAccounts: 'Erlöskonten (19 % / 7 % / ohne MwSt.)', rev19Title: 'Erlöse 19 %', rev7Title: 'Erlöse 7 %',
    revNoVatTitle: 'Ohne MwSt.', saveDefaults: 'Standards speichern', defaultsSaved: 'Steuer-Standards gespeichert.',
    documentsTitle: 'Erstellte Dokumente', documentsSubtitle: 'Verlauf der Übersichten und Exporte', colFile: 'Datei', colType: 'Art', colPeriod: 'Zeitraum',
    colCreated: 'Erstellt', noDocuments: 'Noch keine Dokumente.', typeDatev: 'DATEV-Export', typeEuer: 'EÜR-Übersicht',
    importTitle: 'Umsätze importieren', importSubtitle: 'Treatwell Pro, Planity Pro oder CSV einer beliebigen Plattform', dropFile: 'CSV hierher ziehen oder klicken zum Auswählen',
    dropHint: 'Treatwell „Sale Proceeds“ und Planity-Monatsberichte werden automatisch erkannt', mappingTitle: 'Spaltenzuordnung',
    detectedSource: 'Erkannte Quelle:', genericCsv: 'Allgemeine CSV', uploadToMap: 'Datei hochladen, um Spalten zuzuordnen.',
    fieldDate: 'Datum', fieldDescription: 'Beschreibung', fieldAmount: 'Betrag', fieldMethod: 'Zahlart', column: 'Spalte {number}',
    importRowsOne: '{count} Zeile importieren', importRowsMany: '{count} Zeilen importieren', clear: 'Leeren', historyTitle: 'Import-Verlauf',
    colImported: 'Importiert', colWhen: 'Wann', noImports: 'Noch keine Importe.', noRowsInFile: 'In dieser Datei wurden keine Zeilen erkannt.',
    importFailed: 'Import fehlgeschlagen', importedRows: '{count} Zeilen importiert ({skipped} übersprungen).',
    addEntryTitle: 'Kasseneintrag hinzufügen', addEntrySubtitle: 'Laufkundschaft oder Barverkauf erfassen.', amountGross: 'Betrag (brutto)',
    descriptionPlaceholder: 'Schnitt & Styling — Barzahler', paymentMethod: 'Zahlart', vat: 'MwSt.', cancel: 'Abbrechen', saveEntry: 'Eintrag speichern',
    vat19: '19 % — Regelsatz', vat7: '7 % — ermäßigter Satz', vat0: 'Ohne MwSt. — Kleinunternehmer (§19 UStG)',
    sourceManual: 'Manuell', sourceBooking: 'Zenno-Buchung', sourceImport: 'Import',
    methodCash: 'Bar', methodCard: 'Karte', methodOnline: 'Online', methodGiftCard: 'Gutschein', methodOther: 'Sonstiges',
  },
  th: {
    title: 'ภาษีและรายงาน', subtitle: 'สมุดเงินสด สรุป EÜR ส่งออก DATEV และนำเข้าจากแพลตฟอร์ม', addRecord: 'เพิ่มรายการ',
    tabRecords: 'รายการ', tabPayments: 'การชำระเงินจากการจอง', tabReports: 'รายงานและเอกสาร', tabImport: 'นำเข้า',
    grossPeriod: 'รายได้รวมภาษี (ช่วงเวลา)', vatCollected: 'ภาษีมูลค่าเพิ่มที่เก็บได้ (19%/7%)', vatBreakdown: '{vat19} ที่ 19% · {vat7} ที่ 7% · ก่อนภาษี {net}',
    recordsBySource: '{count} รายการ · ตามแหล่งที่มา',
    setupTitle: 'ต้องตั้งค่าฐานข้อมูลครั้งแรก', setupBefore: 'สร้างตาราง', setupMiddle: 'โดยรัน migration ใน',
    setupAfter: 'ที่ SQL editor ของ Supabase แล้วโหลดหน้านี้ใหม่',
    cashBookEntries: 'รายการสมุดเงินสด', colDate: 'วันที่', colDescription: 'รายละเอียด', colSource: 'แหล่งที่มา', colMethod: 'วิธีชำระ',
    colNet: 'ยอดก่อนภาษี', colVat: 'ภาษีมูลค่าเพิ่ม', colGross: 'ยอดรวมภาษี', noRecords: 'ไม่มีรายการในช่วงเวลานี้', delete: 'ยกเลิกรายการ', confirmDelete: 'ยกเลิกรายการนี้? รายการเดิมยังคงอยู่ และจะเพิ่มรายการติดลบ (Storno) ตามกฎหมายภาษี', cancelled: 'ยกเลิกแล้ว', cancelFailed: 'ยกเลิกรายการไม่สำเร็จ',
    euerTitle: 'สรุปแบบ EÜR', euerSubtitle: 'งบรายรับ-รายจ่ายตามแบบเยอรมัน (พิมพ์ได้ / PDF)', generateSummary: 'สร้างเอกสารสรุป',
    euerHint: 'ตรงกับโครงสร้างบรรทัดที่ที่ปรึกษาภาษีใช้กรอก Anlage EÜR มีการแยกภาษีมูลค่าเพิ่มและยอดรวมตามวิธีชำระ',
    datevTitle: 'DATEV Buchungsstapel', datevSubtitle: 'CSV คั่นด้วยเซมิโคลอนสำหรับที่ปรึกษาภาษี', downloadDatev: 'ดาวน์โหลด DATEV CSV',
    datevHint: 'ชื่อไฟล์ EXTF_ คั่นด้วยเซมิโคลอน ทศนิยมแบบจุลภาค รองรับ ISO-8859-1 กำหนดบัญชีในโปรแกรมภาษีของคุณ',
    defaultsTitle: 'ค่าเริ่มต้นภาษีและการจับคู่บัญชี', defaultsSubtitle: 'ค่าเริ่มต้นสำหรับรายการใหม่และการส่งออก DATEV', defaultVat: 'อัตราภาษีมูลค่าเพิ่มเริ่มต้น',
    cashAccount: 'Kasse (บัญชีเงินสด)', revenueAccounts: 'บัญชีรายได้ (19% / 7% / ไม่มีภาษี)', rev19Title: 'รายได้ 19%', rev7Title: 'รายได้ 7%',
    revNoVatTitle: 'ไม่มีภาษีมูลค่าเพิ่ม', saveDefaults: 'บันทึกค่าเริ่มต้น', defaultsSaved: 'บันทึกค่าเริ่มต้นภาษีแล้ว',
    documentsTitle: 'เอกสารที่สร้างแล้ว', documentsSubtitle: 'ประวัติสรุปและการส่งออก', colFile: 'ไฟล์', colType: 'ประเภท', colPeriod: 'ช่วงเวลา',
    colCreated: 'สร้างเมื่อ', noDocuments: 'ยังไม่มีเอกสาร', typeDatev: 'ส่งออก DATEV', typeEuer: 'สรุป EÜR',
    importTitle: 'นำเข้ารายได้', importSubtitle: 'Treatwell Pro, Planity Pro หรือ CSV จากแพลตฟอร์มใดก็ได้', dropFile: 'ลากไฟล์ CSV มาวางหรือคลิกเพื่อเลือก',
    dropHint: 'ตรวจจับรายงาน "Sale Proceeds" ของ Treatwell และรายงานรายเดือนของ Planity อัตโนมัติ', mappingTitle: 'จับคู่คอลัมน์',
    detectedSource: 'แหล่งที่ตรวจพบ:', genericCsv: 'CSV ทั่วไป', uploadToMap: 'อัปโหลดไฟล์เพื่อจับคู่คอลัมน์',
    fieldDate: 'วันที่', fieldDescription: 'รายละเอียด', fieldAmount: 'จำนวนเงิน', fieldMethod: 'วิธีชำระ', column: 'คอลัมน์ {number}',
    importRowsOne: 'นำเข้า {count} แถว', importRowsMany: 'นำเข้า {count} แถว', clear: 'ล้าง', historyTitle: 'ประวัติการนำเข้า',
    colImported: 'นำเข้าแล้ว', colWhen: 'เมื่อ', noImports: 'ยังไม่มีการนำเข้า', noRowsInFile: 'ไม่พบข้อมูลในไฟล์นี้',
    importFailed: 'นำเข้าไม่สำเร็จ', importedRows: 'นำเข้าแล้ว {count} แถว (ข้าม {skipped})',
    addEntryTitle: 'เพิ่มรายการเงินสด', addEntrySubtitle: 'บันทึกลูกค้า walk-in หรือการขายเงินสด', amountGross: 'จำนวนเงิน (รวมภาษี)',
    descriptionPlaceholder: 'ตัดและจัดทรง — ลูกค้าจ่ายเงินสด', paymentMethod: 'วิธีชำระ', vat: 'ภาษีมูลค่าเพิ่ม', cancel: 'ยกเลิก', saveEntry: 'บันทึกรายการ',
    vat19: '19% — อัตรามาตรฐาน', vat7: '7% — อัตราลดหย่อน', vat0: 'ไม่มีภาษีมูลค่าเพิ่ม — Kleinunternehmer (§19 UStG)',
    sourceManual: 'บันทึกเอง', sourceBooking: 'การจอง Zenno', sourceImport: 'นำเข้า',
    methodCash: 'เงินสด', methodCard: 'บัตร', methodOnline: 'ออนไลน์', methodGiftCard: 'บัตรของขวัญ', methodOther: 'อื่นๆ',
  },
};

/** Screen labels; the tax-advisor documents keep using the fixed SOURCE_LABELS / METHOD_LABELS below. */
const VAT_RATE_KEYS: { bps: number; key: 'vat19' | 'vat7' | 'vat0' }[] = [
  { bps: 1900, key: 'vat19' },
  { bps: 700, key: 'vat7' },
  { bps: 0, key: 'vat0' },
];

const SCREEN_SOURCE_KEYS: Record<string, keyof TaxText> = { manual: 'sourceManual', booking: 'sourceBooking', import: 'sourceImport' };

const SCREEN_METHOD_KEYS: { value: string; key: keyof TaxText }[] = [
  { value: 'cash', key: 'methodCash' },
  { value: 'card', key: 'methodCard' },
  { value: 'online', key: 'methodOnline' },
  { value: 'gift_card', key: 'methodGiftCard' },
  { value: 'other', key: 'methodOther' },
];

const MAPPING_FIELD_KEYS = { date: 'fieldDate', description: 'fieldDescription', amount: 'fieldAmount', method: 'fieldMethod' } as const;

/** Import/save status: a text key built at render, or a server message shown as-is. */
type ImportMessage = { key: 'noRowsInFile' | 'importFailed' | 'defaultsSaved' | 'importedRows'; values?: Record<string, number> } | { text: string };

// Fixed English labels used inside the generated EÜR document (kept unchanged).
const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  booking: 'Zenno booking',
  treatwell: 'Treatwell',
  planity: 'Planity',
  import: 'Import',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  online: 'Online',
  gift_card: 'Gift card',
  other: 'Other',
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  const push = () => { cur.push(field); field = ''; };
  const endRow = () => { push(); if (cur.length > 1 || cur[0] !== '') rows.push(cur); cur = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',' || c === ';' || c === '\t') push();
      else if (c === '\n') { endRow(); }
      else if (c === '\r') { /* skip */ }
      else if (c === '' || c === undefined) { /* skip BOM */ }
      else field += c;
    }
  }
  if (field !== '' || cur.length) endRow();
  return rows;
}

function parseAmountToCents(v: string): number {
  if (!v) return 0;
  const cleaned = v.replace(/[^0-9,\.\-]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma > lastDot) {
    // German decimal comma
    const normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  const n = parseFloat(cleaned.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character] || character);
}

export default function TaxReportsView() {
  const adminUser = adminAuth.getCurrentUser();
  const businessId = adminUser?.business_id;
  const { formatPrice, currency } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const [tab, setTab] = useState<Tab>('records');
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [imports, setImports] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ date: '', description: '', payment_method: 'cash', gross: '', vat_bps: 1900, notes: '' });
  const [defaultVatBps, setDefaultVatBps] = useState(1900);
  const [datevMap, setDatevMap] = useState({ konto: '10000', rev19: '8400', rev7: '8300', revnovat: '9000', bu19: '9', bu7: '8' });
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importSource, setImportSource] = useState<'treatwell' | 'planity' | 'generic'>('generic');
  const [mapping, setMapping] = useState({ date: 0, description: 1, amount: 2, method: 3 });
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(null);
  const [tablesMissing, setTablesMissing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setPeriodStart(toLocalDateString(start));
    setPeriodEnd(toLocalDateString(end));
    setEntryForm(f => ({ ...f, date: toLocalDateString(new Date()) }));
    loadAll();
  }, [businessId]);

  const loadAll = async () => {
    if (!businessId) return;
    setLoading(true);
    const [e, i, d, b, cfgRes] = await Promise.all([
      supabase.from('cash_entries').select('*').eq('business_id', businessId).order('entry_date', { ascending: false }).order('entry_time', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(200),
      supabase.from('revenue_imports').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(20),
      supabase.from('tax_documents').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(20),
      supabase.from('businesses').select('name, address, phone, custom_logo_url').eq('id', businessId).maybeSingle(),
      supabase.from('site_settings').select('key, value').eq('business_id', businessId).in('key', ['tax_default_vat_bps', 'datev_konto', 'datev_rev19', 'datev_rev7', 'datev_revnovat', 'datev_bu19', 'datev_bu7']),
    ]);
    const cfg = (cfgRes?.data as unknown as { key: string; value: string }[] | undefined) || [];
    if (cfg.length) {
      const get = (k: string) => cfg.find(c => c.key === k)?.value;
      const vat = get('tax_default_vat_bps');
      if (vat) {
        const parsed = parseInt(vat, 10);
        if (Number.isFinite(parsed)) { setDefaultVatBps(parsed); setEntryForm(f => f.vat_bps === 1900 ? { ...f, vat_bps: parsed } : f); }
      }
      setDatevMap({
        konto: get('datev_konto') || '10000', rev19: get('datev_rev19') || '8400',
        rev7: get('datev_rev7') || '8300', revnovat: get('datev_revnovat') || '9000',
        bu19: get('datev_bu19') || '9', bu7: get('datev_bu7') || '7',
      });
    }
    if (e.error && /schema cache|does not exist|could not find/i.test(e.error.message)) {
      setTablesMissing(true);
    } else {
      if (e.data) setEntries(e.data);
      if (i.data) setImports(i.data || []);
      if (d.data) setDocuments(d.data as any);
    }
    setBusiness(b.data || null);
    setLoading(false);
  };

  // An entry is cancelled by a manual Storno (reverses_entry_id) or, for booking payments,
  // by the Storno line written when the payment was undone (same booking_payment_id).
  const reversedIds = useMemo(() => {
    const undonePayments = new Set(entries.filter(e => e.is_reversal && e.booking_payment_id).map(e => e.booking_payment_id));
    const ids = entries
      .filter(e => !e.is_reversal && e.booking_payment_id && undonePayments.has(e.booking_payment_id))
      .map(e => e.id);
    return new Set([...ids, ...entries.map(e => e.reverses_entry_id).filter((id): id is string => Boolean(id))]);
  }, [entries]);

  const periodEntries = useMemo(
    () => entries.filter(e => (!periodStart || e.entry_date >= periodStart) && (!periodEnd || e.entry_date <= periodEnd)),
    [entries, periodStart, periodEnd]
  );

  const totals = useMemo(() => {
    const t = { gross: 0, net: 0, vat: 0, cash: 0, card: 0, online: 0, gift_card: 0, other: 0, vat19: 0, vat7: 0 };
    for (const e of periodEntries) {
      t.gross += e.gross_cents;
      t.net += e.net_cents;
      t.vat += e.gross_cents - e.net_cents;
      const m = e.payment_method as keyof typeof t;
      if (m in t && typeof t[m] === 'number') (t[m] as number) += e.gross_cents;
      if (e.vat_rate_bps === 1900) t.vat19 += e.gross_cents - e.net_cents;
      if (e.vat_rate_bps === 700) t.vat7 += e.gross_cents - e.net_cents;
    }
    return t;
  }, [periodEntries]);

  const addEntry = async () => {
    if (!businessId || !entryForm.description || !entryForm.gross) return;
    setSaving(true);
    const grossCents = parseAmountToCents(entryForm.gross);
    const netCents = entryForm.vat_bps > 0 ? Math.round(grossCents / (1 + entryForm.vat_bps / 10000)) : grossCents;
    const { error } = await supabase.from('cash_entries').insert({
      business_id: businessId,
      entry_date: entryForm.date,
      description: entryForm.description,
      payment_method: entryForm.payment_method,
      gross_cents: grossCents,
      net_cents: netCents,
      vat_rate_bps: entryForm.vat_bps,
      source: 'manual',
      created_by: adminUser?.id || null,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setShowAddModal(false);
    setEntryForm(f => ({ ...f, description: '', gross: '', notes: '' }));
    loadAll();
  };

  // GoBD: entries are never deleted; a "Storno" line cancels them.
  const reverseEntry = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    const { error } = await supabase.rpc('reverse_cash_entry', { p_entry_id: id });
    if (error) {
      console.error('Could not cancel cash entry:', error);
      alert(t.cancelFailed);
      return;
    }
    loadAll();
  };

  // ---- DATEV Buchungsstapel export ----
  const exportDatevCsv = () => {
    const rows = periodEntries.map(e => {
      const [, m, d] = e.entry_date.split('-');
      return {
        date: `${d}.${m}.`,                       // Belegdatum TT.MM.
        belegnr: e.id.slice(0, 8).toUpperCase(),  // Belegnummer
        text: (e.description || 'Einnahme').slice(0, 60),
        gross: (e.gross_cents / 100).toFixed(2).replace('.', ','),
        konto: datevMap.konto,
        gegenkonto: e.vat_rate_bps === 1900 ? datevMap.rev19 : e.vat_rate_bps === 700 ? datevMap.rev7 : datevMap.revnovat,
        bu: e.vat_rate_bps === 1900 ? datevMap.bu19 : e.vat_rate_bps === 700 ? datevMap.bu7 : '0',
      };
    });
    const header = '"Umsatz";"S/H";"WKZ";"Konto";"Gegenkonto";"BUSchl";"Belegdatum";"Belegnummer";"Buchungstext"';
    const lines = rows.map(r => `${r.gross};"H";"${currency}";${r.konto};${r.gegenkonto};${r.bu};"${r.date}";"${r.belegnr}";"${r.text.replace(/"/g, '""')}"`);
    const meta = `"Zenno Einnahmen ${periodStart} – ${periodEnd}"\n"Erstellt am ${new Date().toLocaleDateString('de-DE')}"`;
    const csv = [meta, header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EXTF_Zenno-Buchungsstapel_${periodStart}_${periodEnd}.csv`;
    a.click();
    void saveTaxDocument('datev_export', `EXTF_Zenno-Buchungsstapel_${periodStart}_${periodEnd}.csv`, totals);
  };

  // ---- EÜR-style summary document (printable) ----
  const openSummaryDocument = () => {
    void saveTaxDocument('euer_summary', `Zenno-EUeR-Summary_${periodStart}_${periodEnd}.html`, totals);
    const months: Record<string, { gross: number; vat: number; net: number; rows: CashEntry[] }> = {};
    for (const e of periodEntries) {
      const key = e.entry_date.slice(0, 7);
      if (!months[key]) months[key] = { gross: 0, vat: 0, net: 0, rows: [] };
      months[key].gross += e.gross_cents;
      months[key].vat += e.gross_cents - e.net_cents;
      months[key].net += e.net_cents;
      months[key].rows.push(e);
    }
    const [sy, sm] = periodStart.split('-');
    const [ey, em] = periodEnd.split('-');
    const periodLabel = `${sm.padStart(2, '0')}/${sy} – ${em.padStart(2, '0')}/${ey}`;
    const doc = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<title>Zenno — Betriebseinnahmen ${periodLabel}</title>
<style>
  @page { margin: 24mm 18mm; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1A1714; font-size: 11px; margin: 0; }
  .brand { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1A1714; padding-bottom: 10px; margin-bottom: 24px; }
  .brand h1 { font-size: 20px; margin: 0; letter-spacing: -0.02em; }
  .brand .meta { text-align: right; font-size: 10px; color: #6B6560; }
  h2 { font-size: 13px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: .08em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #EEEBE6; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #6B6560; font-weight: 600; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals td { border-top: 2px solid #1A1714; font-weight: 700; }
  thead { display: table-header-group; }
  .foot { margin-top: 36px; font-size: 9.5px; color: #6B6560; border-top: 1px solid #EEEBE6; padding-top: 10px; }
  .note { font-size: 9.5px; color: #6B6560; margin-top: 12px; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()" style="position:fixed;top:16px;right:16px;padding:10px 16px;border:0;border-radius:8px;background:#1A1714;color:#fff;cursor:pointer;font-size:12px;">Print / Save as PDF</button>
  <div class="brand">
    <div>
      <h1>${escapeHtml(business?.name || 'Business')}</h1>
      <div style="font-size:10px;color:#6B6560;">${escapeHtml(business?.address || '')}${business?.phone ? ' · ' + escapeHtml(business.phone) : ''}</div>
    </div>
    <div class="meta">Erstellt am ${new Date().toLocaleDateString('de-DE')}<br/>Report-Zeitraum: ${periodLabel}</div>
  </div>

  <h2>1. Zusammenfassung (Zufluss-Abfluss-Prinzip)</h2>
  <table>
    <thead><tr><th>Gesamtumsatz (brutto)</th><th class="num">Umsatz (netto)</th><th class="num">USt 19%</th><th class="num">USt 7%</th><th class="num">Summe USt</th></tr></thead>
    <tbody class="totals"><tr>
      <td>${formatPrice(totals.gross)}</td>
      <td class="num">${formatPrice(totals.net)}</td>
      <td class="num">${formatPrice(totals.vat19)}</td>
      <td class="num">${formatPrice(totals.vat7)}</td>
      <td class="num">${formatPrice(totals.vat)}</td>
    </tr></tbody>
  </table>

  <h2>2. Nach Zahlungsart</h2>
  <table>
    <thead><tr><th>Zahlungsart</th><th class="num">Betrag (brutto)</th></tr></thead>
    <tbody>
      <tr><td>Bar</td><td class="num">${formatPrice(totals.cash)}</td></tr>
      <tr><td>Karte</td><td class="num">${formatPrice(totals.card)}</td></tr>
      <tr><td>Online</td><td class="num">${formatPrice(totals.online)}</td></tr>
      <tr><td>Geschenkkarte</td><td class="num">${formatPrice(totals.gift_card)}</td></tr>
      <tr><td>Sonstiges</td><td class="num">${formatPrice(totals.other)}</td></tr>
    </tbody>
    <tbody class="totals"><tr><td>Gesamt</td><td class="num">${formatPrice(totals.gross)}</td></tr></tbody>
  </table>

  <h2>3. Monatliche Aufschlüsselung</h2>
  <table>
    <thead><tr><th>Monat</th><th>Belege</th><th class="num">Netto</th><th class="num">USt</th><th class="num">Brutto</th></tr></thead>
    <tbody>
      ${Object.entries(months).sort().map(([k, m]) => `<tr><td>${k}</td><td>${m.rows.length}</td><td class="num">${formatPrice(m.net)}</td><td class="num">${formatPrice(m.vat)}</td><td class="num">${formatPrice(m.gross)}</td></tr>`).join('')}
    </tbody>
    <tbody class="totals"><tr><td>Gesamt</td><td>${periodEntries.length}</td><td class="num">${formatPrice(totals.net)}</td><td class="num">${formatPrice(totals.vat)}</td><td class="num">${formatPrice(totals.gross)}</td></tr></tbody>
  </table>

  <h2>4. Belege (Detail)</h2>
  <table>
    <thead><tr><th>Datum</th><th>Beschreibung</th><th>Quelle</th><th>Zahlungsart</th><th class="num">USt</th><th class="num">Brutto</th></tr></thead>
    <tbody>
      ${periodEntries.map(e => `<tr><td>${escapeHtml(e.entry_date)}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(SOURCE_LABELS[e.source] || e.source)}</td><td>${escapeHtml(METHOD_LABELS[e.payment_method] || e.payment_method)}</td><td class="num">${formatPrice(e.gross_cents - e.net_cents)}</td><td class="num">${formatPrice(e.gross_cents)}</td></tr>`).join('')}
    </tbody>
  </table>

  <p class="note">Hinweis: Dieses Dokument ist eine Aufbereitung der Betriebseinnahmen zur Vorprüfung. Es ersetzt weder die EÜR (Anlage EÜR) in ELSTER noch die Steuerberatung. Zahlen übernimmt dein Steuerberater aus dem DATEV-Export oder dem Buchungsstapel.</p>
  <div class="foot">Zenno · Betriebseinnahmen-Dokument · ${escapeHtml(business?.name || '')} · Erstellt automatisiert</div>
</body>
</html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const saveTaxDocument = async (type: string, fileName: string, totalsObj: any) => {
    if (!businessId) return;
    await supabase.from('tax_documents').insert({
      business_id: businessId,
      period_start: periodStart,
      period_end: periodEnd,
      document_type: type,
      file_name: fileName,
      totals: totalsObj,
      generated_by: adminUser?.id || null,
    });
    setTimeout(loadAll, 300);
  };

  // ---- Import flow ----
  const handleFile = async (file: File) => {
    setImportMessage(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { setImportMessage({ key: 'noRowsInFile' }); return; }
    setImportRows(rows);
    setImportFileName(file.name);
    // Source sniff: Treatwell Pro exports typically have "Belegnr"/"Leistung"/"Betrag" German headers; Planity has "Prestation"/"Montant"
    const headerLine = (rows[0] || []).join('|').toLowerCase();
    if (/treatwell|sale proceeds|belegnr|leistung/.test(headerLine)) setImportSource('treatwell');
    else if (/planity|prestation|montant/.test(headerLine)) setImportSource('planity');
    else setImportSource('generic');
    // guess mapping
    const headers = rows[0].map(h => h.toLowerCase());
    const guess: typeof mapping = { date: 0, description: 1, amount: 2, method: 3 };
    headers.forEach((h, i) => {
      if (/date|datum|day/.test(h)) guess.date = i;
      if (/service|leistung|prestation|description|beschreibung|behandlung/.test(h)) guess.description = i;
      if (/amount|betrag|price|preis|total|umsatz|montant/.test(h)) guess.amount = i;
      if (/method|zahlung|paiement/.test(h)) guess.method = i;
    });
    setMapping(guess);
    setTab('import');
  };

  const commitImport = async () => {
    if (!businessId || importRows.length < 2) return;
    setImporting(true);
    const dataRows = importRows.slice(1);
    const { data: batch, error: bErr } = await supabase.from('revenue_imports').insert({
      business_id: businessId,
      filename: importFileName,
      source: importSource,
      row_count: dataRows.length,
      column_mapping: mapping,
      imported_by: adminUser?.id || null,
      status: 'completed',
    }).select().single();
    if (bErr || !batch) { setImportMessage(bErr?.message ? { text: bErr.message } : { key: 'importFailed' }); setImporting(false); return; }

    const toDate = (v: string): string => {
      const s = v.trim();
      const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m1) return s.slice(0, 10);
      const m2 = s.match(/^(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/);
      if (m2) {
        const dy = m2[3].length === 2 ? '20' + m2[3] : m2[3];
        return `${dy}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
      }
      return periodStart;
    };

    const inserts = dataRows.map(r => {
      const grossCents = parseAmountToCents(r[mapping.amount] || '0');
      const vatBps = 1900;
      const netCents = Math.round(grossCents / (1 + vatBps / 10000));
      const methodCell = (r[mapping.method] || '').toLowerCase();
      const method = /cash|bar/.test(methodCell) ? 'cash' : /card|karte/.test(methodCell) ? 'card' : /online|gutschein|gift/.test(methodCell) ? 'online' : 'other';
      return {
        business_id: businessId,
        entry_date: toDate(r[mapping.date] || ''),
        description: (r[mapping.description] || 'Imported revenue').slice(0, 120),
        payment_method: method,
        gross_cents: grossCents,
        net_cents: netCents,
        vat_rate_bps: vatBps,
        source: importSource,
        import_batch_id: batch.id,
        created_by: adminUser?.id || null,
      };
    }).filter(r => r.gross_cents !== 0);

    const { error: insErr } = await supabase.from('cash_entries').insert(inserts);
    if (insErr) { setImportMessage({ text: insErr.message }); setImporting(false); return; }
    await supabase.from('revenue_imports').update({ imported_count: inserts.length, skipped_count: dataRows.length - inserts.length }).eq('id', batch.id);
    setImportMessage({ key: 'importedRows', values: { count: inserts.length, skipped: dataRows.length - inserts.length } });
    setImporting(false);
    setImportRows([]);
    setTab('records');
    loadAll();
  };

  const TabButton = ({ id, children }: { id: Tab; children: React.ReactNode }) => (
    <button
      onClick={() => setTab(id)}
      className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        tab === id ? 'bg-[#1A1714] text-white' : 'text-stone-600 hover:bg-stone-100'
      }`}
    >
      {children}
    </button>
  );

  const messageText = importMessage
    ? ('key' in importMessage ? fillText(t[importMessage.key], importMessage.values ?? {}) : importMessage.text)
    : '';
  const sourceLabel = (source: string) => {
    const key = SCREEN_SOURCE_KEYS[source];
    return key ? t[key] : SOURCE_LABELS[source] || source;
  };
  const methodLabel = (method: string) => {
    const option = SCREEN_METHOD_KEYS.find((item) => item.value === method);
    return option ? t[option.key] : method;
  };
  const formatDay = (isoDate: string) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    return new Date(year, month - 1, day).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const vatOptions = VAT_RATE_KEYS.map((rate) => <option key={rate.bps} value={rate.bps}>{t[rate.key]}</option>);

  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-stone-900/[0.06]" />
          <div className="h-4 w-80 rounded bg-stone-900/[0.04]" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className={`${SURFACE} h-32 bg-stone-900/[0.025]`} />)}
        </div>
        <div className={`${SURFACE} h-72 bg-stone-900/[0.025]`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">{t.title}</h1>
          <p className="text-sm text-stone-500">{t.subtitle}</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#1A1714] hover:bg-[#2E2926] text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-[0_2px_12px_rgba(26,23,20,0.16)]"
        >
          <Plus className="w-4 h-4" /> {t.addRecord}
        </button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto border-b border-stone-200 px-1 pb-3">
        <TabButton id="records">{t.tabRecords}</TabButton>
        <TabButton id="payments">{t.tabPayments}</TabButton>
        <TabButton id="reports">{t.tabReports}</TabButton>
        <TabButton id="import">{t.tabImport}</TabButton>
      </div>

      {tab === 'payments' && <BookingPaymentsReport />}

      {tab === 'records' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${SURFACE} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <div className={ICON_TILE}><Wallet className="w-4.5 h-4.5 h-[18px] w-[18px] text-stone-700" strokeWidth={1.75} /></div>
              </div>
              <p className="text-[13px] font-medium text-stone-500 mb-1">{t.grossPeriod}</p>
              <p className="text-2xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(totals.gross)}</p>
            </div>
            <div className={`${SURFACE} p-5`}>
              <div className={ICON_TILE}><Percent className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
              <p className="text-[13px] font-medium text-stone-500 mb-1 mt-3">{t.vatCollected}</p>
              <p className="text-2xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(totals.vat)}</p>
              <p className="text-xs text-stone-400 mt-1">{fillText(t.vatBreakdown, { vat19: formatPrice(totals.vat19), vat7: formatPrice(totals.vat7), net: formatPrice(totals.net) })}</p>
            </div>
            <div className={`${SURFACE} p-5`}>
              <div className={ICON_TILE}><Receipt className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
              <p className="text-[13px] font-medium text-stone-500 mb-1 mt-3">{fillText(t.recordsBySource, { count: periodEntries.length })}</p>
              <div className="text-xs text-stone-500 space-y-1 mt-1">
                {(['manual','booking','treatwell','planity','import'] as const).map(src => {
                  const n = periodEntries.filter(e => e.source === src).length;
                  return n > 0 ? <div key={src} className="flex justify-between"><span>{sourceLabel(src)}</span><span className="tabular-nums text-stone-700 font-medium">{n}</span></div> : null;
                })}
              </div>
            </div>
          </div>

          {tablesMissing && (
        <div className={`${SURFACE} border-amber-200 bg-amber-50/70 p-5`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">{t.setupTitle}</p>
              <p className="text-xs text-amber-700 mt-1">{t.setupBefore} <code>cash_entries</code> / <code>revenue_imports</code> / <code>tax_documents</code> {t.setupMiddle} <code>supabase/migrations/20260922090020_tax_and_reporting.sql</code> {t.setupAfter}</p>
            </div>
          </div>
        </div>
      )}
      <div className={SURFACE}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.cashBookEntries}</h3>
              <input type="month" value={(periodEnd || '').slice(0, 7)} onChange={e => {
                const [y, m] = e.target.value.split('-').map(Number);
                const start = new Date(y, m - 1, 1); const end = new Date(y, m, 0);
                setPeriodStart(toLocalDateString(start)); setPeriodEnd(toLocalDateString(end));
              }} className="text-sm border border-stone-200 rounded-lg px-3 py-1.5" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-stone-200 bg-stone-50/50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colDate}</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colDescription}</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colSource}</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colMethod}</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colNet}</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colVat}</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colGross}</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {periodEntries.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-stone-400">{t.noRecords}</td></tr>
                  )}
                  {periodEntries.map(e => {
                    const isCancelled = reversedIds.has(e.id);
                    const isQuiet = isCancelled || e.is_reversal;
                    const amount = isCancelled ? 'line-through decoration-stone-300' : '';
                    return (
                    <tr key={e.id} className={`border-b border-stone-100 hover:bg-stone-50/60 ${isQuiet ? 'text-stone-400' : ''}`}>
                      <td className={`px-5 py-2.5 tabular-nums ${isQuiet ? '' : 'text-stone-600'}`}>
                        {formatDay(e.entry_date)}
                        {e.entry_time && <span className="ml-2 text-stone-400">{e.entry_time.slice(0, 5)}</span>}
                      </td>
                      <td className={`px-5 py-2.5 ${isQuiet ? (e.is_reversal ? 'italic' : '') : 'text-stone-800'}`}>{e.description}</td>
                      <td className={`px-5 py-2.5 ${isQuiet ? '' : 'text-stone-500'}`}>{sourceLabel(e.source)}</td>
                      <td className={`px-5 py-2.5 ${isQuiet ? '' : 'text-stone-500'}`}>{methodLabel(e.payment_method)}</td>
                      <td className={`px-5 py-2.5 text-right tabular-nums ${amount} ${isQuiet ? '' : 'text-stone-600'}`}>{formatPrice(e.net_cents)}</td>
                      <td className={`px-5 py-2.5 text-right tabular-nums ${amount} ${isQuiet ? '' : 'text-stone-500'}`}>{formatPrice(e.gross_cents - e.net_cents)}</td>
                      <td className={`px-5 py-2.5 text-right tabular-nums font-medium ${amount} ${isQuiet ? '' : 'text-stone-800'}`}>{formatPrice(e.gross_cents)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {reversedIds.has(e.id) ? (
                          <span className="text-xs text-stone-400">{t.cancelled}</span>
                        ) : e.source !== 'booking' && !e.is_reversal && (
                          <button onClick={() => reverseEntry(e.id)} className="text-xs text-red-500 hover:text-red-700">{t.delete}</button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={SURFACE}>
            <div className="p-5 pb-3">
              <div className="flex items-center gap-3 mb-1">
                <div className={ICON_TILE}><FileText className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.euerTitle}</h3>
                  <p className="text-xs text-stone-500">{t.euerSubtitle}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 mb-3">
                <input type="month" value={(periodEnd || '').slice(0, 7)} onChange={e => {
                  const [y, m] = e.target.value.split('-').map(Number);
                  const start = new Date(y, m - 1, 1); const end = new Date(y, m, 0);
                  setPeriodStart(toLocalDateString(start)); setPeriodEnd(toLocalDateString(end));
                }} className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 flex-1" />
              </div>
              <button onClick={openSummaryDocument} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926]">
                <FileText className="w-4 h-4" /> {t.generateSummary}
              </button>
              <p className="text-xs text-stone-400 mt-2">{t.euerHint}</p>
            </div>
          </div>

          <div className={SURFACE}>
            <div className="p-5 pb-3">
              <div className="flex items-center gap-3 mb-1">
                <div className={ICON_TILE}><Building2 className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.datevTitle}</h3>
                  <p className="text-xs text-stone-500">{t.datevSubtitle}</p>
                </div>
              </div>
              <button onClick={exportDatevCsv} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-200 bg-white hover:bg-stone-50 text-stone-700">
                <Download className="w-4 h-4" /> {t.downloadDatev}
              </button>
              <p className="text-xs text-stone-400 mt-2">{t.datevHint}</p>
            </div>
          </div>

          <div className={`${SURFACE} lg:col-span-2`}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={ICON_TILE}><Percent className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.defaultsTitle}</h3>
                  <p className="text-xs text-stone-500">{t.defaultsSubtitle}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t.defaultVat}</label>
                  <select value={defaultVatBps} onChange={e => setDefaultVatBps(Number(e.target.value))} className="w-full border border-stone-200 rounded-lg px-3 py-2">
                    {vatOptions}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t.cashAccount}</label>
                  <input value={datevMap.konto} onChange={e => setDatevMap({ ...datevMap, konto: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t.revenueAccounts}</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input value={datevMap.rev19} onChange={e => setDatevMap({ ...datevMap, rev19: e.target.value })} className="w-full border border-stone-200 rounded-lg px-2 py-2 tabular-nums" title={t.rev19Title}/>
                    <input value={datevMap.rev7} onChange={e => setDatevMap({ ...datevMap, rev7: e.target.value })} className="w-full border border-stone-200 rounded-lg px-2 py-2 tabular-nums" title={t.rev7Title}/>
                    <input value={datevMap.revnovat} onChange={e => setDatevMap({ ...datevMap, revnovat: e.target.value })} className="w-full border border-stone-200 rounded-lg px-2 py-2 tabular-nums" title={t.revNoVatTitle}/>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (!businessId) return;
                    const updates = [
                      { key: 'tax_default_vat_bps', value: String(defaultVatBps), category: 'tax' },
                      { key: 'datev_konto', value: datevMap.konto, category: 'tax' },
                      { key: 'datev_rev19', value: datevMap.rev19, category: 'tax' },
                      { key: 'datev_rev7', value: datevMap.rev7, category: 'tax' },
                      { key: 'datev_revnovat', value: datevMap.revnovat, category: 'tax' },
                      { key: 'datev_bu19', value: datevMap.bu19, category: 'tax' },
                      { key: 'datev_bu7', value: datevMap.bu7, category: 'tax' },
                    ];
                    const { error } = await supabase.from('site_settings').upsert(
                      updates.map(u => ({ business_id: businessId, ...u, updated_at: new Date().toISOString() })),
                      { onConflict: 'business_id,key' }
                    );
                    if (!error) {
                      setImportMessage({ key: 'defaultsSaved' });
                      setTimeout(() => setImportMessage(null), 2500);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926]"
                >
                  {t.saveDefaults}
                </button>
                {importMessage && <p className="text-xs text-emerald-600">{messageText}</p>}
              </div>
            </div>
          </div>

          <div className={`${SURFACE} lg:col-span-2`}>
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.documentsTitle}</h3>
              <p className="text-xs text-stone-500">{t.documentsSubtitle}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-stone-200 bg-stone-50/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colFile}</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colType}</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colPeriod}</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colGross}</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colCreated}</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-stone-400">{t.noDocuments}</td></tr>}
                {documents.map(d => (
                  <tr key={d.id} className="border-b border-stone-100">
                    <td className="px-5 py-2.5 text-stone-800">{d.file_name}</td>
                    <td className="px-5 py-2.5 text-stone-500">{d.document_type === 'datev_export' ? t.typeDatev : t.typeEuer}</td>
                    <td className="px-5 py-2.5 text-stone-500 tabular-nums">{formatDay(d.period_start)} – {formatDay(d.period_end)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-stone-800">{formatPrice(d.totals?.gross ?? 0)}</td>
                    <td className="px-5 py-2.5 text-stone-500">{new Date(d.created_at).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={SURFACE}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={ICON_TILE}><Upload className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.importTitle}</h3>
                  <p className="text-xs text-stone-500">{t.importSubtitle}</p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-stone-300 rounded-2xl p-8 text-center hover:border-stone-400 hover:bg-stone-50 transition-colors"
              >
                <Upload className="w-6 h-6 text-stone-400 mx-auto mb-2" />
                <p className="text-sm text-stone-700 font-medium">{t.dropFile}</p>
                <p className="text-xs text-stone-400 mt-1">{t.dropHint}</p>
              </button>
              {importMessage && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4" /> {messageText}
                </div>
              )}
            </div>
          </div>

          <div className={SURFACE}>
            <div className="p-5">
              <h3 className="text-[15px] font-semibold text-[#1A1714] mb-1">{t.mappingTitle}</h3>
              <p className="text-xs text-stone-500 mb-4">{t.detectedSource} <span className="font-medium text-stone-700">{importSource === 'treatwell' ? 'Treatwell Pro' : importSource === 'planity' ? 'Planity Pro' : t.genericCsv}</span></p>
              {importRows.length === 0 ? (
                <p className="text-sm text-stone-400 py-8 text-center">{t.uploadToMap}</p>
              ) : (
                <div className="space-y-3 text-sm">
                  {(['date', 'description', 'amount', 'method'] as const).map(key => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="w-28 text-stone-600">{t[MAPPING_FIELD_KEYS[key]]}</label>
                      <select
                        value={mapping[key]}
                        onChange={e => setMapping({ ...mapping, [key]: Number(e.target.value) })}
                        className="flex-1 border border-stone-200 rounded-lg px-2 py-1.5"
                      >
                        {importRows[0].map((h, i) => <option key={i} value={i}>{h || fillText(t.column, { number: i + 1 })} {i === mapping[key] ? '✓' : ''}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="pt-2 flex gap-2">
                    <button onClick={commitImport} disabled={importing} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926] disabled:opacity-50">
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {fillText(importRows.length - 1 === 1 ? t.importRowsOne : t.importRowsMany, { count: importRows.length - 1 })}
                    </button>
                    <button onClick={() => setImportRows([])} className="px-4 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-stone-100">{t.clear}</button>
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-stone-50">{importRows[0].map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-semibold text-stone-500">{h}</th>)}</tr></thead>
                      <tbody>
                        {importRows.slice(1, 8).map((r, ri) => <tr key={ri} className="border-t border-stone-100">{importRows[0].map((_, ci) => <td key={ci} className="px-2 py-1.5 text-stone-600">{r[ci]}</td>)}</tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`${SURFACE} lg:col-span-2`}>
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-[15px] font-semibold text-[#1A1714]">{t.historyTitle}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-stone-200 bg-stone-50/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colFile}</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colSource}</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colImported}</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">{t.colWhen}</th>
                </tr>
              </thead>
              <tbody>
                {imports.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-stone-400">{t.noImports}</td></tr>}
                {imports.map(imp => (
                  <tr key={imp.id} className="border-b border-stone-100">
                    <td className="px-5 py-2.5 text-stone-800">{imp.filename}</td>
                    <td className="px-5 py-2.5 text-stone-500 capitalize">{imp.source === 'generic' ? t.genericCsv : imp.source}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-stone-800">{imp.imported_count}/{imp.row_count}</td>
                    <td className="px-5 py-2.5 text-stone-500">{new Date(imp.created_at).toLocaleDateString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white/95 backdrop-blur-xl border border-stone-200/80 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold tracking-tight text-[#1A1714] mb-1">{t.addEntryTitle}</h2>
            <p className="text-xs text-stone-500 mb-4">{t.addEntrySubtitle}</p>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t.colDate}</label>
                  <input type="date" value={entryForm.date} onChange={e => setEntryForm({ ...entryForm, date: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t.amountGross}</label>
                  <input value={entryForm.gross} onChange={e => setEntryForm({ ...entryForm, gross: e.target.value })} placeholder="65,00" className="w-full border border-stone-200 rounded-lg px-3 py-2 tabular-nums" inputMode="decimal" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">{t.colDescription}</label>
                <input value={entryForm.description} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} placeholder={t.descriptionPlaceholder} className="w-full border border-stone-200 rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t.paymentMethod}</label>
                  <select value={entryForm.payment_method} onChange={e => setEntryForm({ ...entryForm, payment_method: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2">
                    {SCREEN_METHOD_KEYS.map((method) => <option key={method.value} value={method.value}>{t[method.key]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t.vat}</label>
                  <select value={entryForm.vat_bps} onChange={e => setEntryForm({ ...entryForm, vat_bps: Number(e.target.value) })} className="w-full border border-stone-200 rounded-lg px-3 py-2">
                    {vatOptions}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-stone-100">{t.cancel}</button>
              <button onClick={addEntry} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926] disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t.saveEntry}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
