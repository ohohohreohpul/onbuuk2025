import { useMemo, useState } from 'react';
import { CalendarClock, CalendarOff, FileUp, Loader2, Users } from 'lucide-react';
import { useTenant } from '../../../../lib/tenantContext';
import { autoMap, IMPORT_FIELDS, readCsvTable, type ColumnMapping, type CsvTable, type ImportKind } from '../../../../lib/dataImport/csvTable';
import { buildBookings, buildCustomers, buildTimeBlocks, type CatalogLookup } from '../../../../lib/dataImport/buildRows';
import { loadCatalog, saveBookings, saveCustomers, saveTimeBlocks, type SaveSummary } from './dataImportApi';
import { ADMIN_PRIMARY_BUTTON, ADMIN_SELECT } from '../../adminUi';

const KINDS: { kind: ImportKind; label: string; hint: string; icon: typeof Users }[] = [
  { kind: 'customers', label: 'Customers', hint: 'Name, email, phone', icon: Users },
  { kind: 'bookings', label: 'Appointments', hint: 'Upcoming bookings: date, time, treatment, therapist, customer', icon: CalendarClock },
  { kind: 'timeBlocks', label: 'Blocked times', hint: 'Holidays, breaks, time off (empty therapist = whole shop)', icon: CalendarOff },
];

/** Move a shop from EasyWeek or another system: CSV in, columns mapped, rows checked, saved. */
export default function DataImport() {
  const { businessId } = useTenant();
  const [kind, setKind] = useState<ImportKind>('customers');
  const [table, setTable] = useState<CsvTable | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [catalog, setCatalog] = useState<CatalogLookup | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<SaveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (parsed.headers.length === 0 || parsed.rows.length === 0) throw new Error('The file has no rows.');
      setTable(parsed);
      setFileName(file.name);
      setMapping(autoMap(kind, parsed.headers));
      if (businessId && !catalog) setCatalog(await loadCatalog(businessId));
    } catch (readError) {
      console.error('Could not read import file:', readError);
      setError(readError instanceof Error ? readError.message : 'Could not read the file. Export it as CSV.');
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
      setError('The import stopped unexpectedly. Rows already saved stay saved.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-stone-900">Import from another system</h3>
        <p className="text-sm text-stone-500">
          Export customers, appointments or blocked times from EasyWeek (or Shore, Treatwell, …) as CSV and import them here.
          Imported appointments don't send confirmation emails; customers still get the reminder the day before.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="What to import">
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
            <span className="block font-medium text-stone-900">{label}</span>
            <span className="block text-xs text-stone-500">{hint}</span>
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 p-5 hover:border-stone-400">
        <FileUp className="h-5 w-5 text-stone-500" aria-hidden="true" />
        <span className="text-sm text-stone-700">{fileName ? `${fileName} · ${table?.rows.length ?? 0} rows — choose another file` : 'Choose a CSV file'}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
      </label>

      {table && (
        <div className="grid gap-3 sm:grid-cols-2">
          {IMPORT_FIELDS[kind].map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="font-medium text-stone-700">{field.label}</span>
              <select
                className={`${ADMIN_SELECT} mt-1`}
                value={mapping[field.key] ?? ''}
                onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value === '' ? null : Number(e.target.value) }))}
              >
                <option value="">— not in file —</option>
                {table.headers.map((header, index) => (
                  <option key={`${header}-${index}`} value={index}>{header || `Column ${index + 1}`}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {preview && (
        <div className="rounded-xl bg-stone-50 p-4 text-sm">
          <p className="font-medium text-stone-900">{preview.rows.length} ready to import · {preview.errors.length} skipped</p>
          {preview.errors.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-stone-600">
              {preview.errors.slice(0, 50).map((message) => <li key={message}>{message}</li>)}
            </ul>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {summary && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">{summary.saved} imported{summary.failed.length ? ` · ${summary.failed.length} not imported` : ''}.</p>
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
          {progress ? `Importing ${progress.done}/${progress.total}…` : `Import ${preview?.rows.length ?? 0}`}
        </button>
      </div>
    </div>
  );
}
