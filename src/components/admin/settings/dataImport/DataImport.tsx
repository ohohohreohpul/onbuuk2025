import { useMemo, useState } from 'react';
import { CalendarClock, CalendarOff, FileUp, Loader2, Users } from 'lucide-react';
import { useTenant } from '../../../../lib/tenantContext';
import { useAdminText } from '../../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../../lib/bookingLanguage';
import { autoMap, IMPORT_FIELDS, readCsvTable, type ColumnMapping, type CsvTable, type ImportKind } from '../../../../lib/dataImport/csvTable';
import { buildBookings, buildCustomers, buildTimeBlocks, type CatalogLookup } from '../../../../lib/dataImport/buildRows';
import { loadCatalog, saveBookings, saveCustomers, saveTimeBlocks, type SaveSummary } from './dataImportApi';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SELECT } from '../../adminUi';

type ImportText = {
  title: string; intro: string; introNote: string; whatToImport: string;
  kindCustomers: string; hintCustomers: string; kindBookings: string; hintBookings: string; kindTimeBlocks: string; hintTimeBlocks: string;
  chooseFile: string; fileChosen: string; notInFile: string; column: string;
  previewSummary: string; importedSummary: string; notImported: string;
  importing: string; importCount: string;
  noRows: string; readFailed: string; importFailed: string;
  field_name: string; field_firstName: string; field_lastName: string; field_email: string; field_phone: string;
  field_date: string; field_time: string; field_duration: string; field_service: string; field_specialist: string; field_notes: string;
  field_start: string; field_end: string; field_specialistShop: string; field_reason: string;
};

const TEXT: Translations<ImportText> = {
  en: {
    title: 'Import from another system',
    intro: 'Export customers, appointments or blocked times from EasyWeek (or Shore, Treatwell, …) as CSV and import them here.',
    introNote: "Imported appointments don't send confirmation emails; customers still get the reminder the day before.",
    whatToImport: 'What to import',
    kindCustomers: 'Customers', hintCustomers: 'Name, email, phone',
    kindBookings: 'Appointments', hintBookings: 'Upcoming bookings: date, time, treatment, therapist, customer',
    kindTimeBlocks: 'Blocked times', hintTimeBlocks: 'Holidays, breaks, time off (empty therapist = whole shop)',
    chooseFile: 'Choose a CSV file', fileChosen: '{file} · {count} rows — choose another file',
    notInFile: '— not in file —', column: 'Column {number}',
    previewSummary: '{ready} ready to import · {skipped} skipped',
    importedSummary: '{count} imported', notImported: ' · {count} not imported',
    importing: 'Importing {done}/{total}…', importCount: 'Import {count}',
    noRows: 'The file has no rows.', readFailed: 'Could not read the file. Export it as CSV.',
    importFailed: 'The import stopped unexpectedly. Rows already saved stay saved.',
    field_name: 'Full name', field_firstName: 'First name', field_lastName: 'Last name', field_email: 'Email', field_phone: 'Phone',
    field_date: 'Date', field_time: 'Start time', field_duration: 'Duration', field_service: 'Treatment', field_specialist: 'Therapist', field_notes: 'Notes',
    field_start: 'Start (date + time)', field_end: 'End (date + time)', field_specialistShop: 'Therapist (empty = whole shop)', field_reason: 'Reason',
  },
  de: {
    title: 'Aus einem anderen System importieren',
    intro: 'Kunden, Termine oder Blockzeiten aus EasyWeek (oder Shore, Treatwell, …) als CSV exportieren und hier importieren.',
    introNote: 'Importierte Termine lösen keine Bestätigungs-E-Mails aus; Kunden erhalten weiterhin die Erinnerung am Vortag.',
    whatToImport: 'Was importieren',
    kindCustomers: 'Kunden', hintCustomers: 'Name, E-Mail, Telefon',
    kindBookings: 'Termine', hintBookings: 'Kommende Buchungen: Datum, Uhrzeit, Behandlung, Therapeut, Kunde',
    kindTimeBlocks: 'Blockzeiten', hintTimeBlocks: 'Feiertage, Pausen, Abwesenheiten (ohne Therapeut = ganzer Shop)',
    chooseFile: 'CSV-Datei auswählen', fileChosen: '{file} · {count} Zeilen — andere Datei auswählen',
    notInFile: '— nicht in der Datei —', column: 'Spalte {number}',
    previewSummary: '{ready} bereit zum Import · {skipped} übersprungen',
    importedSummary: '{count} importiert', notImported: ' · {count} nicht importiert',
    importing: 'Importiere {done}/{total}…', importCount: '{count} importieren',
    noRows: 'Die Datei enthält keine Zeilen.', readFailed: 'Datei konnte nicht gelesen werden. Bitte als CSV exportieren.',
    importFailed: 'Der Import wurde unerwartet abgebrochen. Bereits gespeicherte Zeilen bleiben erhalten.',
    field_name: 'Vollständiger Name', field_firstName: 'Vorname', field_lastName: 'Nachname', field_email: 'E-Mail', field_phone: 'Telefon',
    field_date: 'Datum', field_time: 'Startzeit', field_duration: 'Dauer', field_service: 'Behandlung', field_specialist: 'Therapeut', field_notes: 'Notizen',
    field_start: 'Beginn (Datum + Uhrzeit)', field_end: 'Ende (Datum + Uhrzeit)', field_specialistShop: 'Therapeut (leer = ganzer Shop)', field_reason: 'Grund',
  },
  th: {
    title: 'นำเข้าจากระบบอื่น',
    intro: 'ส่งออกลูกค้า นัดหมาย หรือช่วงเวลาปิดรับจองจาก EasyWeek (หรือ Shore, Treatwell, …) เป็น CSV แล้วนำเข้าที่นี่',
    introNote: 'นัดหมายที่นำเข้าจะไม่ส่งอีเมลยืนยัน แต่ลูกค้ายังได้รับการแจ้งเตือนหนึ่งวันก่อนนัด',
    whatToImport: 'ข้อมูลที่จะนำเข้า',
    kindCustomers: 'ลูกค้า', hintCustomers: 'ชื่อ อีเมล โทรศัพท์',
    kindBookings: 'นัดหมาย', hintBookings: 'การจองที่จะถึง: วันที่ เวลา ทรีตเมนต์ นักบำบัด ลูกค้า',
    kindTimeBlocks: 'ช่วงเวลาปิดรับจอง', hintTimeBlocks: 'วันหยุด เวลาพัก วันลา (ไม่ระบุนักบำบัด = ทั้งร้าน)',
    chooseFile: 'เลือกไฟล์ CSV', fileChosen: '{file} · {count} แถว — เลือกไฟล์อื่น',
    notInFile: '— ไม่มีในไฟล์ —', column: 'คอลัมน์ {number}',
    previewSummary: 'พร้อมนำเข้า {ready} · ข้าม {skipped}',
    importedSummary: 'นำเข้าแล้ว {count}', notImported: ' · นำเข้าไม่ได้ {count}',
    importing: 'กำลังนำเข้า {done}/{total}…', importCount: 'นำเข้า {count}',
    noRows: 'ไฟล์นี้ไม่มีข้อมูล', readFailed: 'อ่านไฟล์ไม่ได้ กรุณาส่งออกเป็น CSV',
    importFailed: 'การนำเข้าหยุดกะทันหัน แถวที่บันทึกแล้วยังคงอยู่',
    field_name: 'ชื่อเต็ม', field_firstName: 'ชื่อ', field_lastName: 'นามสกุล', field_email: 'อีเมล', field_phone: 'โทรศัพท์',
    field_date: 'วันที่', field_time: 'เวลาเริ่ม', field_duration: 'ระยะเวลา', field_service: 'ทรีตเมนต์', field_specialist: 'นักบำบัด', field_notes: 'หมายเหตุ',
    field_start: 'เริ่ม (วันที่ + เวลา)', field_end: 'สิ้นสุด (วันที่ + เวลา)', field_specialistShop: 'นักบำบัด (ว่าง = ทั้งร้าน)', field_reason: 'เหตุผล',
  },
};

type ErrorKey = 'noRows' | 'readFailed' | 'importFailed';

class NoRowsError extends Error {}

const KINDS: { kind: ImportKind; label: keyof ImportText; hint: keyof ImportText; icon: typeof Users }[] = [
  { kind: 'customers', label: 'kindCustomers', hint: 'hintCustomers', icon: Users },
  { kind: 'bookings', label: 'kindBookings', hint: 'hintBookings', icon: CalendarClock },
  { kind: 'timeBlocks', label: 'kindTimeBlocks', hint: 'hintTimeBlocks', icon: CalendarOff },
];

/** Screen label for an import field; falls back to the field's own English label. */
function fieldLabel(t: ImportText, kind: ImportKind, key: string, fallback: string): string {
  const textKey = (kind === 'timeBlocks' && key === 'specialist' ? 'field_specialistShop' : `field_${key}`) as keyof ImportText;
  return t[textKey] ?? fallback;
}

/** Move a shop from EasyWeek or another system: CSV in, columns mapped, rows checked, saved. */
export default function DataImport() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const [kind, setKind] = useState<ImportKind>('customers');
  const [table, setTable] = useState<CsvTable | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [catalog, setCatalog] = useState<CatalogLookup | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<SaveSummary | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);

  const chooseKind = (next: ImportKind) => {
    setKind(next);
    setSummary(null);
    if (table) setMapping(autoMap(next, table.headers));
  };

  const readFile = async (file: File) => {
    setError(null);
    setSummary(null);
    try {
      const parsed = readCsvTable(await file.text());
      if (parsed.headers.length === 0 || parsed.rows.length === 0) throw new NoRowsError();
      setTable(parsed);
      setFileName(file.name);
      setMapping(autoMap(kind, parsed.headers));
      if (businessId && !catalog) setCatalog(await loadCatalog(businessId));
    } catch (readError) {
      console.error('Could not read import file:', readError);
      setError(readError instanceof NoRowsError ? 'noRows' : 'readFailed');
    }
  };

  const preview = useMemo(() => {
    if (!table) return null;
    if (kind === 'customers') return buildCustomers(table, mapping);
    if (!catalog) return null;
    return kind === 'bookings' ? buildBookings(table, mapping, catalog) : buildTimeBlocks(table, mapping, catalog);
  }, [table, mapping, kind, catalog]);

  const runImport = async () => {
    if (!businessId || !preview || preview.rows.length === 0) return;
    setError(null);
    setProgress({ done: 0, total: preview.rows.length });
    try {
      const result = kind === 'customers'
        ? await saveCustomers(businessId, preview.rows as Parameters<typeof saveCustomers>[1])
        : kind === 'bookings'
          ? await saveBookings(businessId, preview.rows as Parameters<typeof saveBookings>[1], (done) => setProgress({ done, total: preview.rows.length }))
          : await saveTimeBlocks(businessId, preview.rows as Parameters<typeof saveTimeBlocks>[1]);
      setSummary(result);
    } catch (saveError) {
      console.error('Import failed:', saveError);
      setError('importFailed');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-stone-900">{t.title}</h3>
        <p className="text-sm text-stone-500">
          {t.intro} {t.introNote}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.whatToImport}>
        {KINDS.map(({ kind: option, label, hint, icon: Icon }) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            onClick={() => chooseKind(option)}
            className={`rounded-xl border p-4 text-left transition ${kind === option ? 'border-[#1A1714] bg-stone-50' : 'border-stone-200 hover:border-stone-300'}`}
          >
            <Icon className="mb-2 h-5 w-5 text-stone-600" aria-hidden="true" />
            <span className="block font-medium text-stone-900">{t[label]}</span>
            <span className="block text-xs text-stone-500">{t[hint]}</span>
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 p-5 hover:border-stone-400">
        <FileUp className="h-5 w-5 text-stone-500" aria-hidden="true" />
        <span className="text-sm text-stone-700">{fileName ? fillText(t.fileChosen, { file: fileName, count: table?.rows.length ?? 0 }) : t.chooseFile}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
      </label>

      {table && (
        <div className="grid gap-3 sm:grid-cols-2">
          {IMPORT_FIELDS[kind].map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="font-medium text-stone-700">{fieldLabel(t, kind, field.key, field.label)}</span>
              <select
                className={`${ADMIN_SELECT} mt-1`}
                value={mapping[field.key] ?? ''}
                onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value === '' ? null : Number(e.target.value) }))}
              >
                <option value="">{t.notInFile}</option>
                {table.headers.map((header, index) => (
                  <option key={`${header}-${index}`} value={index}>{header || fillText(t.column, { number: index + 1 })}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {preview && (
        <div className="rounded-xl bg-stone-50 p-4 text-sm">
          <p className="font-medium text-stone-900">{fillText(t.previewSummary, { ready: preview.rows.length, skipped: preview.errors.length })}</p>
          {preview.errors.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-stone-600">
              {preview.errors.slice(0, 50).map((message) => <li key={message}>{message}</li>)}
            </ul>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{t[error]}</p>}
      {summary && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">{fillText(t.importedSummary, { count: summary.saved })}{summary.failed.length ? fillText(t.notImported, { count: summary.failed.length }) : ''}.</p>
          {summary.failed.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-emerald-800">
              {summary.failed.slice(0, 50).map((message) => <li key={message}>{message}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" className={ADMIN_PRIMARY_BUTTON} disabled={!preview || preview.rows.length === 0 || progress !== null} onClick={runImport}>
          {progress ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileUp className="h-4 w-4" aria-hidden="true" />}
          {progress ? fillText(t.importing, { done: progress.done, total: progress.total }) : fillText(t.importCount, { count: preview?.rows.length ?? 0 })}
        </button>
      </div>
    </div>
  );
}
