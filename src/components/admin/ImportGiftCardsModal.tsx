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

const friendlyInsertError = (message: string) =>
  message.includes('gift_cards_code_key') || message.includes('duplicate key')
    ? 'This code is already used by another gift card.'
    : message.includes('service_pass')
      ? 'The service pass details are incomplete.'
      : 'Could not be saved. Please try again.';

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
    const passName = exampleOffer?.name ?? '10er Karte Massage';
    const passVisits = exampleOffer?.visit_count ?? 10;
    downloadCsv('gift_cards_import_template.csv', [
      '# Gift card import template',
      '# type: "value" for a money gift card, "service_pass" for a visit pass (empty = value)',
      '# code: leave empty to generate one, or use your own (4-40 letters, numbers, dashes; must be unique)',
      `# value: money cards = balance in ${currency}; service passes = price paid (empty = the pass price)`,
      '# pass: service passes only - the exact name of a Service Pass you created',
      '# visits: service passes only - visits left on the card (empty = all visits of the pass)',
      '# recipient_email: optional',
      '# expires_at: optional, 2027-12-31 or 31.12.2027 (empty = your default expiry)',
      activeOffers.length > 0
        ? `# Your service passes: ${activeOffers.map((offer) => offer.name).join(' | ')}`
        : '# You have no service passes yet: create one under Service Passes to import passes.',
      'type,code,value,pass,visits,recipient_email,expires_at',
      'value,,50.00,,,customer@example.com,',
      'value,GC-CUSTOM-CODE,100.00,,,,2027-12-31',
      `service_pass,,,${csvCell(passName)},${passVisits},regular@example.com,`,
      `service_pass,,,${csvCell(passName)},3,,`,
    ]);
  };

  const readFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors(['Please choose a .csv file. In Excel or Numbers use "Export as CSV".']);
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
      setErrors(['The file could not be read. Please try again.']);
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
          if (codeError || !generated) throw new Error('Could not generate a code.');
          code = generated as string;
        }

        const { error: insertError } = await supabase.from('gift_cards').insert(toGiftCardInsert(row, businessId, code));
        if (insertError) {
          console.error(`Gift card import row ${row.rowNumber} failed:`, insertError);
          results.push({ row, code, error: friendlyInsertError(insertError.message) });
        } else {
          results.push({ row, code, error: null });
        }
      } catch (error) {
        console.error(`Gift card import row ${row.rowNumber} failed:`, error);
        results.push({ row, code: row.code, error: error instanceof Error ? error.message : 'Could not be saved.' });
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
              <h2 className="text-2xl font-semibold text-gray-900">Import Gift Cards</h2>
              <p className="text-gray-600 mt-1">Bulk create gift cards and service passes from a CSV file</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 transition-colors">
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
                    <h3 className="font-medium text-gray-900">Download Template</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      A ready-to-fill file with examples for money gift cards
                      {activeOffers.length > 0 ? ' and your service passes' : ''}.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Template</span>
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
                <p className="text-lg font-medium text-gray-700">Click to upload CSV file</p>
                <p className="text-sm text-gray-500 mt-2">or drag and drop it here</p>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">CSV Format Guide</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>type:</strong> <code>value</code> for a money gift card, <code>service_pass</code> for a visit pass (empty = value)</li>
                  <li>• <strong>code:</strong> leave empty to generate a unique code</li>
                  <li>• <strong>value:</strong> money cards: balance in {currency}. Service passes: price paid (empty = pass price)</li>
                  <li>• <strong>pass:</strong> service passes only: the exact name of your Service Pass</li>
                  <li>• <strong>visits:</strong> service passes only: visits left (empty = all visits)</li>
                  <li>• <strong>recipient_email:</strong> optional</li>
                  <li>
                    • <strong>expires_at:</strong> optional, e.g. 2027-12-31 or 31.12.2027
                    {expiryDays ? ` (empty = ${expiryDays} days from today, or the pass's own expiry)` : ''}
                  </li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                  {activeOffers.length > 0
                    ? `Your service passes: ${activeOffers.map((offer) => offer.name).join(', ')}`
                    : 'You have no service passes yet. Create one under Service Passes to import passes.'}
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
                        {errors.length} row{errors.length === 1 ? '' : 's'} will be skipped
                      </h3>
                      <ul className="text-sm text-red-700 mt-2 space-y-1">
                        {errors.slice(0, 50).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                      {errors.length > 50 && <p className="text-sm text-red-700 mt-1">… and {errors.length - 50} more</p>}
                    </div>
                  </div>
                </div>
              )}

              {rows.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
                      <p className="text-sm text-gray-600">Ready to import</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{formatAmount(totalValueCents / 100)}</p>
                      <p className="text-sm text-gray-600">{valueRows.length} money card{valueRows.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{passRows.length}</p>
                      <p className="text-sm text-gray-600">Service passes</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{rows.filter((row) => !row.code).length}</p>
                      <p className="text-sm text-gray-600">Codes to generate</p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Row', 'Type', 'Code', 'Value / Pass', 'Recipient', 'Expires'].map((heading) => (
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
                                  <Ticket className="h-3 w-3" /> Pass
                                </span>
                              ) : (
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">Money</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-900">
                              {row.code || <span className="text-gray-400 italic font-sans">Auto</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-900">
                              {row.type === 'value' ? (
                                <span className="font-medium">{formatAmount(row.valueCents / 100)}</span>
                              ) : (
                                <span>
                                  <span className="font-medium">{row.offer.name}</span>
                                  <span className="block text-xs text-gray-500">
                                    {row.visitsLeft} of {row.visitsTotal} visits left · paid {formatAmount(row.pricePaidCents / 100)}
                                  </span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{row.recipientEmail || '–'}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : 'Never'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > PREVIEW_LIMIT && (
                      <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 text-center">
                        … and {rows.length - PREVIEW_LIMIT} more
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
              <p className="text-lg font-medium text-gray-900">Creating gift cards…</p>
              <div className="mt-4 w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                <div className="bg-[#1A1714] h-2 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{importProgress}% complete</p>
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
                  {failed.length === 0 ? 'Import complete' : 'Import finished with problems'}
                </h3>
                <p className="text-gray-600 mb-6">
                  Created {succeeded} card{succeeded === 1 ? '' : 's'}
                  {failed.length > 0 && <span className="text-red-600">, {failed.length} not created</span>}.
                </p>
              </div>

              {failed.length > 0 && (
                <div className="mx-auto mb-6 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <ul className="space-y-1">
                    {failed.slice(0, 20).map(({ row, code, error }) => (
                      <li key={row.rowNumber}>• Row {row.rowNumber}{code ? ` (${code})` : ''}: {error}</li>
                    ))}
                  </ul>
                  {failed.length > 20 && <p className="mt-1">… and {failed.length - 20} more. See the results file.</p>}
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={downloadResults}
                  className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download results</span>
                </button>
                <button
                  onClick={async () => {
                    await onImportComplete();
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors"
                >
                  Done
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
              {step === 'preview' ? 'Back' : 'Cancel'}
            </button>
            {step === 'preview' && rows.length > 0 && (
              <button
                onClick={handleImport}
                className="px-6 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors"
              >
                Import {rows.length} card{rows.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
