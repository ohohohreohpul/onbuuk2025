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
}

type Tab = 'records' | 'reports' | 'import';

const SURFACE =
  'bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl shadow-[0_2px_16px_rgba(26,23,20,0.05)]';
const ICON_TILE = 'w-10 h-10 rounded-xl bg-stone-900/[6%] flex items-center justify-center shrink-0';

const VAT_RATES = [
  { bps: 1900, label: '19% — Standard rate' },
  { bps: 700, label: '7% — Reduced rate' },
  { bps: 0, label: 'No VAT — Kleinunternehmer (§19 UStG)' },
];

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
  const [importMessage, setImportMessage] = useState('');
  const [tablesMissing, setTablesMissing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = new Date();
    const start = new Date(t.getFullYear(), t.getMonth(), 1);
    const end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
    setPeriodStart(start.toISOString().split('T')[0]);
    setPeriodEnd(end.toISOString().split('T')[0]);
    setEntryForm(f => ({ ...f, date: new Date().toISOString().split('T')[0] }));
    loadAll();
  }, [businessId]);

  const loadAll = async () => {
    if (!businessId) return;
    setLoading(true);
    const [e, i, d, b, cfgRes] = await Promise.all([
      supabase.from('cash_entries').select('*').eq('business_id', businessId).order('entry_date', { ascending: false }).limit(200),
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

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await supabase.from('cash_entries').delete().eq('id', id);
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
    setImportMessage('');
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) { setImportMessage('No rows detected in this file.'); return; }
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
    if (bErr || !batch) { setImportMessage(bErr?.message || 'Import batch failed'); setImporting(false); return; }

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
    if (insErr) { setImportMessage(insErr.message); setImporting(false); return; }
    await supabase.from('revenue_imports').update({ imported_count: inserts.length, skipped_count: dataRows.length - inserts.length }).eq('id', batch.id);
    setImportMessage(`Imported ${inserts.length} rows (${dataRows.length - inserts.length} skipped).`);
    setImporting(false);
    setImportRows([]);
    setTab('records');
    loadAll();
  };

  const TabButton = ({ id, children }: { id: Tab; children: React.ReactNode }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        tab === id ? 'bg-[#1A1714] text-white' : 'text-stone-600 hover:bg-stone-100'
      }`}
    >
      {children}
    </button>
  );

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
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714]">Tax & Reports</h1>
          <p className="text-sm text-stone-500">Kassenbuch, EÜR summaries, DATEV exports, and platform imports</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-[#1A1714] hover:bg-[#2E2926] text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-[0_2px_12px_rgba(26,23,20,0.16)]"
        >
          <Plus className="w-4 h-4" /> Add record
        </button>
      </div>

      <div className="flex gap-2 border-b border-stone-200 pb-3">
        <TabButton id="records">Records</TabButton>
        <TabButton id="reports">Reports & Documents</TabButton>
        <TabButton id="import">Import</TabButton>
      </div>

      {tab === 'records' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${SURFACE} p-5`}>
              <div className="flex items-center justify-between mb-3">
                <div className={ICON_TILE}><Wallet className="w-4.5 h-4.5 h-[18px] w-[18px] text-stone-700" strokeWidth={1.75} /></div>
              </div>
              <p className="text-[13px] font-medium text-stone-500 mb-1">Gross turnover (period)</p>
              <p className="text-2xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(totals.gross)}</p>
            </div>
            <div className={`${SURFACE} p-5`}>
              <div className={ICON_TILE}><Percent className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
              <p className="text-[13px] font-medium text-stone-500 mb-1 mt-3">VAT collected (19%/7%)</p>
              <p className="text-2xl font-semibold tracking-tight text-[#1A1714] tabular-nums">{formatPrice(totals.vat)}</p>
              <p className="text-xs text-stone-400 mt-1">{formatPrice(totals.vat19)} at 19% · {formatPrice(totals.vat7)} at 7% · {formatPrice(totals.net)} net</p>
            </div>
            <div className={`${SURFACE} p-5`}>
              <div className={ICON_TILE}><Receipt className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
              <p className="text-[13px] font-medium text-stone-500 mb-1 mt-3">{periodEntries.length} records · by source</p>
              <div className="text-xs text-stone-500 space-y-1 mt-1">
                {(['manual','booking','treatwell','planity','import'] as const).map(src => {
                  const n = periodEntries.filter(e => e.source === src).length;
                  return n > 0 ? <div key={src} className="flex justify-between"><span>{SOURCE_LABELS[src]}</span><span className="tabular-nums text-stone-700 font-medium">{n}</span></div> : null;
                })}
              </div>
            </div>
          </div>

          {tablesMissing && (
        <div className={`${SURFACE} border-amber-200 bg-amber-50/70 p-5`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">One-time database setup required</p>
              <p className="text-xs text-amber-700 mt-1">Create the <code>cash_entries</code> / <code>revenue_imports</code> / <code>tax_documents</code> tables by running the migration in <code>supabase/migrations/20260922090020_tax_and_reporting.sql</code> in your Supabase SQL editor, then reload this page.</p>
            </div>
          </div>
        </div>
      )}
      <div className={SURFACE}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-[15px] font-semibold text-[#1A1714]">Kassenbuch entries</h3>
              <input type="month" value={(periodEnd || '').slice(0, 7)} onChange={e => {
                const [y, m] = e.target.value.split('-').map(Number);
                const start = new Date(y, m - 1, 1); const end = new Date(y, m, 0);
                setPeriodStart(start.toISOString().split('T')[0]); setPeriodEnd(end.toISOString().split('T')[0]);
              }} className="text-sm border border-stone-200 rounded-lg px-3 py-1.5" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-stone-200 bg-stone-50/50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Description</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Source</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Method</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Net</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">VAT</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Gross</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {periodEntries.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-10 text-stone-400">No records in this period.</td></tr>
                  )}
                  {periodEntries.map(e => (
                    <tr key={e.id} className="border-b border-stone-100 hover:bg-stone-50/60">
                      <td className="px-5 py-2.5 text-stone-600 tabular-nums">{e.entry_date}</td>
                      <td className="px-5 py-2.5 text-stone-800">{e.description}</td>
                      <td className="px-5 py-2.5 text-stone-500">{SOURCE_LABELS[e.source] || e.source}</td>
                      <td className="px-5 py-2.5 text-stone-500">{METHOD_LABELS[e.payment_method] || e.payment_method}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-stone-600">{formatPrice(e.net_cents)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-stone-500">{formatPrice(e.gross_cents - e.net_cents)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium text-stone-800">{formatPrice(e.gross_cents)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {e.source === 'manual' && (
                          <button onClick={() => deleteEntry(e.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
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
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">EÜR-style summary</h3>
                  <p className="text-xs text-stone-500">German income-surplus statement (printable / PDF)</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 mb-3">
                <input type="month" value={(periodEnd || '').slice(0, 7)} onChange={e => {
                  const [y, m] = e.target.value.split('-').map(Number);
                  const start = new Date(y, m - 1, 1); const end = new Date(y, m, 0);
                  setPeriodStart(start.toISOString().split('T')[0]); setPeriodEnd(end.toISOString().split('T')[0]);
                }} className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 flex-1" />
              </div>
              <button onClick={openSummaryDocument} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926]">
                <FileText className="w-4 h-4" /> Generate summary document
              </button>
              <p className="text-xs text-stone-400 mt-2">Covers the EÜR line structure your tax adviser maps in Anlage EÜR. VAT split and payment-method totals are included.</p>
            </div>
          </div>

          <div className={SURFACE}>
            <div className="p-5 pb-3">
              <div className="flex items-center gap-3 mb-1">
                <div className={ICON_TILE}><Building2 className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">DATEV Buchungsstapel</h3>
                  <p className="text-xs text-stone-500">Semicolon CSV for the Steuerberater</p>
                </div>
              </div>
              <button onClick={exportDatevCsv} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-stone-200 bg-white hover:bg-stone-50 text-stone-700">
                <Download className="w-4 h-4" /> Download DATEV CSV
              </button>
              <p className="text-xs text-stone-400 mt-2">EXTF_ filename, semicolon-separated, decimal comma, ISO-8859-1-safe. Map accounts in your tax software.</p>
            </div>
          </div>

          <div className={`${SURFACE} lg:col-span-2`}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={ICON_TILE}><Percent className="w-[18px] h-[18px] text-stone-700" strokeWidth={1.75} /></div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">Tax defaults & account mapping</h3>
                  <p className="text-xs text-stone-500">Defaults for new records and DATEV export</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Default VAT rate</label>
                  <select value={defaultVatBps} onChange={e => setDefaultVatBps(Number(e.target.value))} className="w-full border border-stone-200 rounded-lg px-3 py-2">
                    {VAT_RATES.map(r => <option key={r.bps} value={r.bps}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Kasse (cash account)</label>
                  <input value={datevMap.konto} onChange={e => setDatevMap({ ...datevMap, konto: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2 tabular-nums" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Revenue accounts (19% / 7% / no VAT)</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input value={datevMap.rev19} onChange={e => setDatevMap({ ...datevMap, rev19: e.target.value })} className="w-full border border-stone-200 rounded-lg px-2 py-2 tabular-nums" title="19% revenue"/>
                    <input value={datevMap.rev7} onChange={e => setDatevMap({ ...datevMap, rev7: e.target.value })} className="w-full border border-stone-200 rounded-lg px-2 py-2 tabular-nums" title="7% revenue"/>
                    <input value={datevMap.revnovat} onChange={e => setDatevMap({ ...datevMap, revnovat: e.target.value })} className="w-full border border-stone-200 rounded-lg px-2 py-2 tabular-nums" title="No VAT"/>
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
                      setImportMessage('Tax defaults saved.');
                      setTimeout(() => setImportMessage(''), 2500);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926]"
                >
                  Save defaults
                </button>
                {importMessage && <p className="text-xs text-emerald-600">{importMessage}</p>}
              </div>
            </div>
          </div>

          <div className={`${SURFACE} lg:col-span-2`}>
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-[15px] font-semibold text-[#1A1714]">Generated documents</h3>
              <p className="text-xs text-stone-500">History of summaries and exports</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-stone-200 bg-stone-50/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">File</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Period</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Gross</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-stone-400">No documents yet.</td></tr>}
                {documents.map(d => (
                  <tr key={d.id} className="border-b border-stone-100">
                    <td className="px-5 py-2.5 text-stone-800">{d.file_name}</td>
                    <td className="px-5 py-2.5 text-stone-500">{d.document_type === 'datev_export' ? 'DATEV export' : 'EÜR summary'}</td>
                    <td className="px-5 py-2.5 text-stone-500 tabular-nums">{d.period_start} – {d.period_end}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-stone-800">{formatPrice(d.totals?.gross ?? 0)}</td>
                    <td className="px-5 py-2.5 text-stone-500">{new Date(d.created_at).toLocaleDateString()}</td>
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
                  <h3 className="text-[15px] font-semibold text-[#1A1714]">Import revenue</h3>
                  <p className="text-xs text-stone-500">Treatwell Pro, Planity Pro, or any platform CSV</p>
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
                <p className="text-sm text-stone-700 font-medium">Drop a CSV here or click to browse</p>
                <p className="text-xs text-stone-400 mt-1">Treatwell "Sale Proceeds" and Planity monthly reports detected automatically</p>
              </button>
              {importMessage && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4" /> {importMessage}
                </div>
              )}
            </div>
          </div>

          <div className={SURFACE}>
            <div className="p-5">
              <h3 className="text-[15px] font-semibold text-[#1A1714] mb-1">Column mapping</h3>
              <p className="text-xs text-stone-500 mb-4">Detected source: <span className="font-medium text-stone-700">{importSource === 'treatwell' ? 'Treatwell Pro' : importSource === 'planity' ? 'Planity Pro' : 'Generic CSV'}</span></p>
              {importRows.length === 0 ? (
                <p className="text-sm text-stone-400 py-8 text-center">Upload a file to map columns.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  {(['date', 'description', 'amount', 'method'] as const).map(key => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="w-28 text-stone-600 capitalize">{key}</label>
                      <select
                        value={mapping[key]}
                        onChange={e => setMapping({ ...mapping, [key]: Number(e.target.value) })}
                        className="flex-1 border border-stone-200 rounded-lg px-2 py-1.5"
                      >
                        {importRows[0].map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`} {i === mapping[key] ? '✓' : ''}</option>)}
                      </select>
                    </div>
                  ))}
                  <div className="pt-2 flex gap-2">
                    <button onClick={commitImport} disabled={importing} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926] disabled:opacity-50">
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Import {importRows.length - 1} rows
                    </button>
                    <button onClick={() => setImportRows([])} className="px-4 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-stone-100">Clear</button>
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
              <h3 className="text-[15px] font-semibold text-[#1A1714]">Import history</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-stone-200 bg-stone-50/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">File</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Source</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Imported</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wider">When</th>
                </tr>
              </thead>
              <tbody>
                {imports.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-stone-400">No imports yet.</td></tr>}
                {imports.map(imp => (
                  <tr key={imp.id} className="border-b border-stone-100">
                    <td className="px-5 py-2.5 text-stone-800">{imp.filename}</td>
                    <td className="px-5 py-2.5 text-stone-500 capitalize">{imp.source}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-stone-800">{imp.imported_count}/{imp.row_count}</td>
                    <td className="px-5 py-2.5 text-stone-500">{new Date(imp.created_at).toLocaleDateString()}</td>
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
            <h2 className="text-lg font-semibold tracking-tight text-[#1A1714] mb-1">Add cash entry</h2>
            <p className="text-xs text-stone-500 mb-4">Record a walk-in or cash sale.</p>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Date</label>
                  <input type="date" value={entryForm.date} onChange={e => setEntryForm({ ...entryForm, date: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Amount (gross)</label>
                  <input value={entryForm.gross} onChange={e => setEntryForm({ ...entryForm, gross: e.target.value })} placeholder="65,00" className="w-full border border-stone-200 rounded-lg px-3 py-2 tabular-nums" inputMode="decimal" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
                <input value={entryForm.description} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} placeholder="Cut & Style — cash customer" className="w-full border border-stone-200 rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Payment method</label>
                  <select value={entryForm.payment_method} onChange={e => setEntryForm({ ...entryForm, payment_method: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                    <option value="gift_card">Gift card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">VAT</label>
                  <select value={entryForm.vat_bps} onChange={e => setEntryForm({ ...entryForm, vat_bps: Number(e.target.value) })} className="w-full border border-stone-200 rounded-lg px-3 py-2">
                    {VAT_RATES.map(r => <option key={r.bps} value={r.bps}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-stone-100">Cancel</button>
              <button onClick={addEntry} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1A1714] text-white hover:bg-[#2E2926] disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
