import { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileText, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';

interface ParsedGiftCard {
  code: string | null; // null means auto-generate
  original_value_cents: number;
  recipient_email: string | null;
  expires_at: string | null;
}

interface ImportGiftCardsModalProps {
  onClose: () => void;
  onImportComplete: () => void | Promise<void>;
  expiryDays: number | null;
}

export function ImportGiftCardsModal({ onClose, onImportComplete, expiryDays }: ImportGiftCardsModalProps) {
  const { businessId } = useTenant();
  const { formatAmount } = useCurrency();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedGiftCards, setParsedGiftCards] = useState<ParsedGiftCard[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; codes: string[] }>({ success: 0, failed: 0, codes: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'code',
      'value_eur',
      'recipient_email',
      'expires_at'
    ];

    const exampleRows = [
      ['', '50.00', 'customer@example.com', ''],
      ['GC-CUSTOM-CODE', '100.00', '', '2025-12-31'],
      ['', '75.00', 'gift@example.com', '']
    ];

    const instructions = [
      '# Gift Card Import Template',
      '# ',
      '# Instructions:',
      '# - code: Leave empty to auto-generate, or provide custom code (must be unique)',
      '# - value_eur: Gift card value in EUR (required)',
      '# - recipient_email: Optional email address of recipient',
      '# - expires_at: Optional expiry date (YYYY-MM-DD format), leave empty to use default settings',
      '#'
    ];

    const csvContent = [
      ...instructions,
      headers.join(','),
      ...exampleRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gift_cards_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (csvText: string): { giftCards: ParsedGiftCard[]; errors: string[] } => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
    if (lines.length < 2) {
      return { giftCards: [], errors: ['CSV file must have a header row and at least one data row'] };
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const giftCards: ParsedGiftCard[] = [];
    const errors: string[] = [];

    // Validate required headers
    if (!headers.includes('value_eur')) {
      return { giftCards: [], errors: ['Missing required column: value_eur'] };
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      // Parse value
      const value = parseFloat(row.value_eur);
      if (isNaN(value) || value <= 0) {
        errors.push(`Row ${i + 1}: Valid positive value is required`);
        continue;
      }

      // Parse expires_at
      let expiresAt: string | null = null;
      if (row.expires_at) {
        const date = new Date(row.expires_at);
        if (isNaN(date.getTime())) {
          errors.push(`Row ${i + 1}: Invalid date format for expires_at (use YYYY-MM-DD)`);
          continue;
        }
        expiresAt = date.toISOString();
      } else if (expiryDays) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + expiryDays);
        expiresAt = expiry.toISOString();
      }

      giftCards.push({
        code: row.code || null,
        original_value_cents: Math.round(value * 100),
        recipient_email: row.recipient_email || null,
        expires_at: expiresAt
      });
    }

    return { giftCards, errors };
  };

  // Parse CSV line handling quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { giftCards, errors } = parseCSV(text);
      setParsedGiftCards(giftCards);
      setErrors(errors);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!businessId || parsedGiftCards.length === 0) return;

    setStep('importing');
    setImportProgress(0);
    let success = 0;
    let failed = 0;
    const codes: string[] = [];

    for (let i = 0; i < parsedGiftCards.length; i++) {
      const giftCard = parsedGiftCards[i];
      try {
        // Generate code if not provided
        let code: string = giftCard.code || '';
        if (!code) {
          const { data: generatedCode, error: codeError } = await supabase.rpc('generate_gift_card_code');
          if (codeError || !generatedCode) {
            throw new Error('Failed to generate gift card code');
          }
          code = generatedCode as string;
        }

        // Insert gift card
        const { error: insertError } = await supabase
          .from('gift_cards')
          .insert({
            business_id: businessId,
            code: code,
            original_value_cents: giftCard.original_value_cents,
            current_balance_cents: giftCard.original_value_cents,
            purchased_for_email: giftCard.recipient_email,
            expires_at: giftCard.expires_at,
            status: 'active'
          });

        if (insertError) {
          throw new Error(insertError.message);
        }

        codes.push(code);
        success++;
      } catch (error) {
        console.error('Error importing gift card:', error);
        failed++;
      }

      setImportProgress(Math.round(((i + 1) / parsedGiftCards.length) * 100));
    }

    setImportResults({ success, failed, codes });
    setStep('complete');
  };

  const downloadImportedCodes = () => {
    const csvContent = ['code,value_eur,status', ...importResults.codes.map(code => {
      const gc = parsedGiftCards.find(g => g.code === code || !g.code);
      return `${code},${gc ? (gc.original_value_cents / 100).toFixed(2) : ''},imported`;
    })].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `imported_gift_cards_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Import Gift Cards</h2>
              <p className="text-gray-600 mt-1">Bulk create gift cards from a CSV file</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Download Template */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900">Download Template</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Download the CSV template with instructions and example data.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Template</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">Click to upload CSV file</p>
                <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Instructions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">CSV Format Guide</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>code:</strong> Leave empty to auto-generate unique codes</li>
                  <li>• <strong>value_eur:</strong> Gift card value in EUR (required)</li>
                  <li>• <strong>recipient_email:</strong> Optional email for the gift card recipient</li>
                  <li>• <strong>expires_at:</strong> Optional expiry date (YYYY-MM-DD format){expiryDays && ` - defaults to ${expiryDays} days from now`}</li>
                </ul>
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
                      <h3 className="font-medium text-red-900">Validation Errors</h3>
                      <ul className="text-sm text-red-700 mt-2 space-y-1">
                        {errors.map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {parsedGiftCards.length > 0 && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-900 font-medium">
                        {parsedGiftCards.length} gift card(s) ready to import
                      </span>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{parsedGiftCards.length}</p>
                      <p className="text-sm text-gray-600">Total Cards</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {formatAmount(parsedGiftCards.reduce((sum, gc) => sum + gc.original_value_cents, 0) / 100)}
                      </p>
                      <p className="text-sm text-gray-600">Total Value</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">
                        {parsedGiftCards.filter(gc => !gc.code).length}
                      </p>
                      <p className="text-sm text-gray-600">Auto-Generate Codes</p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Code</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Value</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Recipient Email</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Expires</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {parsedGiftCards.slice(0, 20).map((gc, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-gray-900">
                              {gc.code || <span className="text-gray-400 italic">Auto-generate</span>}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {formatAmount(gc.original_value_cents / 100)}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {gc.recipient_email || '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {gc.expires_at ? new Date(gc.expires_at).toLocaleDateString() : 'Never'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedGiftCards.length > 20 && (
                      <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 text-center">
                        ... and {parsedGiftCards.length - 20} more gift cards
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-lg font-medium text-gray-900">Creating gift cards...</p>
              <div className="mt-4 w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{importProgress}% complete</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Complete!</h3>
              <p className="text-gray-600 mb-6">
                Successfully created {importResults.success} gift card(s)
                {importResults.failed > 0 && (
                  <span className="text-red-600"> ({importResults.failed} failed)</span>
                )}
              </p>
              
              {importResults.codes.length > 0 && (
                <div className="mb-6">
                  <button
                    onClick={downloadImportedCodes}
                    className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Imported Codes</span>
                  </button>
                </div>
              )}
              
              <button
                onClick={async () => {
                  await onImportComplete();
                  onClose();
                }}
                className="px-6 py-3 bg-[#008374] text-white rounded-lg hover:bg-[#006d5f] transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 'upload' || step === 'preview') && (
          <div className="p-6 border-t border-gray-200 flex justify-between">
            <button
              onClick={() => step === 'preview' ? setStep('upload') : onClose()}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {step === 'preview' ? 'Back' : 'Cancel'}
            </button>
            {step === 'preview' && parsedGiftCards.length > 0 && (
              <button
                onClick={handleImport}
                className="px-6 py-2.5 bg-[#008374] text-white rounded-lg hover:bg-[#006d5f] transition-colors"
              >
                Import {parsedGiftCards.length} Gift Card(s)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
