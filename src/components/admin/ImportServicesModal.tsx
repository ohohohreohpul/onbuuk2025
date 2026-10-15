import { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  title: string; subtitle: string; close: string; templateTitle: string; templateHint: string; downloadTemplate: string;
  uploadPrompt: string; dragDrop: string; guideTitle: string; guideRequiredLabel: string; guideRequired: string;
  guidePairLabel: string; guidePair: string; guidePricesLabel: string; guidePrices: string; guideDurationsLabel: string;
  guideDurations: string; guideBuffersLabel: string; guideBuffers: string; validationErrors: string;
  readyOne: string; readyMany: string; colName: string; colCategory: string; colDurations: string; colOptions: string;
  minutesShort: string; couples: string; importing: string; percentComplete: string; complete: string;
  importedOne: string; importedMany: string; failedCount: string; done: string; back: string; cancel: string;
  importOne: string; importMany: string; errNoRows: string; errMissingColumns: string; errNameRequired: string;
  errCategoryRequired: string; errDurationRequired: string;
}> = {
  en: {
    title: 'Import services', subtitle: 'Import services from a CSV file', close: 'Close',
    templateTitle: 'Download template', templateHint: 'Download the CSV template to see the required format and example data.',
    downloadTemplate: 'Download template', uploadPrompt: 'Click to upload CSV file', dragDrop: 'or drag and drop',
    guideTitle: 'CSV format guide', guideRequiredLabel: 'Required columns:', guideRequired: 'name, category, and at least one duration with price',
    guidePairLabel: 'is_pair_massage:', guidePair: "Use 'true' or 'false' for couples availability",
    guidePricesLabel: 'Prices:', guidePrices: 'Enter values in {currency} ({symbol}), using the business currency setting (e.g., 45.00)',
    guideDurationsLabel: 'Durations:', guideDurations: 'You can have up to 5 duration/price pairs per service',
    guideBuffersLabel: 'Buffer times:', guideBuffers: 'Enter in minutes', validationErrors: 'Validation errors',
    readyOne: '1 service ready to import', readyMany: '{count} services ready to import',
    colName: 'Name', colCategory: 'Category', colDurations: 'Durations & prices', colOptions: 'Options',
    minutesShort: '{minutes} min', couples: 'Couples', importing: 'Importing services…', percentComplete: '{percent}% complete',
    complete: 'Import complete', importedOne: 'Successfully imported 1 service', importedMany: 'Successfully imported {count} services',
    failedCount: '({count} failed)', done: 'Done', back: 'Back', cancel: 'Cancel',
    importOne: 'Import 1 service', importMany: 'Import {count} services',
    errNoRows: 'The CSV file needs a header row and at least one data row.', errMissingColumns: 'Missing required columns: {columns}',
    errNameRequired: 'Row {row}: Name is required', errCategoryRequired: 'Row {row}: Category is required',
    errDurationRequired: 'Row {row}: At least one duration with price is required',
  },
  de: {
    title: 'Leistungen importieren', subtitle: 'Leistungen aus einer CSV-Datei importieren', close: 'Schließen',
    templateTitle: 'Vorlage herunterladen', templateHint: 'Laden Sie die CSV-Vorlage herunter, um Format und Beispieldaten zu sehen.',
    downloadTemplate: 'Vorlage herunterladen', uploadPrompt: 'Klicken, um eine CSV-Datei hochzuladen', dragDrop: 'oder per Drag & Drop',
    guideTitle: 'Hinweise zum CSV-Format', guideRequiredLabel: 'Pflichtspalten:', guideRequired: 'name, category und mindestens eine Dauer mit Preis',
    guidePairLabel: 'is_pair_massage:', guidePair: "'true' oder 'false' für Paarbuchung angeben",
    guidePricesLabel: 'Preise:', guidePrices: 'Beträge in {currency} ({symbol}) gemäß Währungseinstellung angeben (z. B. 45.00)',
    guideDurationsLabel: 'Dauer:', guideDurations: 'Bis zu 5 Dauer/Preis-Paare pro Leistung möglich',
    guideBuffersLabel: 'Pufferzeiten:', guideBuffers: 'In Minuten angeben', validationErrors: 'Fehler bei der Prüfung',
    readyOne: '1 Leistung bereit zum Import', readyMany: '{count} Leistungen bereit zum Import',
    colName: 'Name', colCategory: 'Kategorie', colDurations: 'Dauer & Preise', colOptions: 'Optionen',
    minutesShort: '{minutes} Min.', couples: 'Paarbuchung', importing: 'Leistungen werden importiert…', percentComplete: '{percent} % erledigt',
    complete: 'Import abgeschlossen', importedOne: '1 Leistung erfolgreich importiert', importedMany: '{count} Leistungen erfolgreich importiert',
    failedCount: '({count} fehlgeschlagen)', done: 'Fertig', back: 'Zurück', cancel: 'Abbrechen',
    importOne: '1 Leistung importieren', importMany: '{count} Leistungen importieren',
    errNoRows: 'Die CSV-Datei braucht eine Kopfzeile und mindestens eine Datenzeile.', errMissingColumns: 'Fehlende Pflichtspalten: {columns}',
    errNameRequired: 'Zeile {row}: Name fehlt', errCategoryRequired: 'Zeile {row}: Kategorie fehlt',
    errDurationRequired: 'Zeile {row}: Mindestens eine Dauer mit Preis ist erforderlich',
  },
  th: {
    title: 'นำเข้าบริการ', subtitle: 'นำเข้าบริการจากไฟล์ CSV', close: 'ปิด',
    templateTitle: 'ดาวน์โหลดเทมเพลต', templateHint: 'ดาวน์โหลดเทมเพลต CSV เพื่อดูรูปแบบที่ต้องใช้และข้อมูลตัวอย่าง',
    downloadTemplate: 'ดาวน์โหลดเทมเพลต', uploadPrompt: 'คลิกเพื่ออัปโหลดไฟล์ CSV', dragDrop: 'หรือลากไฟล์มาวาง',
    guideTitle: 'คำแนะนำรูปแบบ CSV', guideRequiredLabel: 'คอลัมน์ที่ต้องมี:', guideRequired: 'name, category และอย่างน้อยหนึ่งระยะเวลาพร้อมราคา',
    guidePairLabel: 'is_pair_massage:', guidePair: "ใส่ 'true' หรือ 'false' เพื่อกำหนดว่าจองคู่ได้หรือไม่",
    guidePricesLabel: 'ราคา:', guidePrices: 'ใส่ราคาเป็น {currency} ({symbol}) ตามสกุลเงินของร้าน (เช่น 45.00)',
    guideDurationsLabel: 'ระยะเวลา:', guideDurations: 'แต่ละบริการมีคู่ระยะเวลา/ราคาได้สูงสุด 5 คู่',
    guideBuffersLabel: 'เวลาเผื่อ:', guideBuffers: 'ใส่เป็นนาที', validationErrors: 'ข้อผิดพลาดในการตรวจสอบ',
    readyOne: 'บริการ 1 รายการพร้อมนำเข้า', readyMany: 'บริการ {count} รายการพร้อมนำเข้า',
    colName: 'ชื่อ', colCategory: 'หมวดหมู่', colDurations: 'ระยะเวลาและราคา', colOptions: 'ตัวเลือก',
    minutesShort: '{minutes} นาที', couples: 'จองคู่', importing: 'กำลังนำเข้าบริการ…', percentComplete: 'เสร็จแล้ว {percent}%',
    complete: 'นำเข้าเสร็จสิ้น', importedOne: 'นำเข้าบริการสำเร็จ 1 รายการ', importedMany: 'นำเข้าบริการสำเร็จ {count} รายการ',
    failedCount: '(ไม่สำเร็จ {count} รายการ)', done: 'เสร็จสิ้น', back: 'ย้อนกลับ', cancel: 'ยกเลิก',
    importOne: 'นำเข้าบริการ 1 รายการ', importMany: 'นำเข้าบริการ {count} รายการ',
    errNoRows: 'ไฟล์ CSV ต้องมีแถวหัวตารางและข้อมูลอย่างน้อยหนึ่งแถว', errMissingColumns: 'ไม่มีคอลัมน์ที่จำเป็น: {columns}',
    errNameRequired: 'แถว {row}: ต้องระบุชื่อ', errCategoryRequired: 'แถว {row}: ต้องระบุหมวดหมู่',
    errDurationRequired: 'แถว {row}: ต้องมีอย่างน้อยหนึ่งระยะเวลาพร้อมราคา',
  },
};

type ParseErrorKey = 'errNoRows' | 'errMissingColumns' | 'errNameRequired' | 'errCategoryRequired' | 'errDurationRequired';

/** Parse errors are stored as keys and turned into text at render, so they follow the admin language. */
interface ParseError {
  key: ParseErrorKey;
  row?: number;
  columns?: string;
}

interface ParsedService {
  name: string;
  description: string;
  category: string;
  is_pair_massage: boolean;
  image_url: string | null;
  buffer_before: number;
  buffer_after: number;
  no_show_fee: number;
  late_cancel_fee: number;
  late_cancel_hours: number;
  durations: Array<{ duration_minutes: number; price_cents: number }>;
}

interface ImportServicesModalProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportServicesModal({ onClose, onImportComplete }: ImportServicesModalProps) {
  const { businessId } = useTenant();
  const { currency, currencySymbol, formatPrice } = useCurrency();
  const { t } = useAdminText(TEXT);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedServices, setParsedServices] = useState<ParsedService[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'name',
      'description',
      'category',
      'is_pair_massage',
      'image_url',
      'buffer_before_minutes',
      'buffer_after_minutes',
      'no_show_fee',
      'late_cancel_fee',
      'late_cancel_hours',
      'duration1_minutes',
      'duration1_price',
      'duration2_minutes',
      'duration2_price',
      'duration3_minutes',
      'duration3_price'
    ];

    const exampleRow = [
      'Swedish Massage',
      'A relaxing full body massage',
      'Massage',
      'true',
      'https://example.com/image.jpg',
      '5',
      '10',
      '25.00',
      '15.00',
      '24',
      '30',
      '45.00',
      '60',
      '75.00',
      '90',
      '110.00'
    ];

    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'services_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (csvText: string): { services: ParsedService[]; errors: ParseError[] } => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      return { services: [], errors: [{ key: 'errNoRows' }] };
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const services: ParsedService[] = [];
    const errors: ParseError[] = [];

    // Validate required headers
    const requiredHeaders = ['name', 'category'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return { services: [], errors: [{ key: 'errMissingColumns', columns: missingHeaders.join(', ') }] };
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      // Validate required fields
      if (!row.name) {
        errors.push({ key: 'errNameRequired', row: i + 1 });
        continue;
      }
      if (!row.category) {
        errors.push({ key: 'errCategoryRequired', row: i + 1 });
        continue;
      }

      // Parse durations
      const durations: Array<{ duration_minutes: number; price_cents: number }> = [];
      for (let d = 1; d <= 5; d++) {
        const minutes = parseFloat(row[`duration${d}_minutes`]);
        const price = parseFloat(row[`duration${d}_price`] || row[`duration${d}_price_eur`]);
        if (!isNaN(minutes) && minutes > 0 && !isNaN(price) && price >= 0) {
          durations.push({
            duration_minutes: Math.round(minutes),
            price_cents: Math.round(price * 100)
          });
        }
      }

      if (durations.length === 0) {
        errors.push({ key: 'errDurationRequired', row: i + 1 });
        continue;
      }

      services.push({
        name: row.name,
        description: row.description || '',
        category: row.category,
        is_pair_massage: ['true', '1', 'yes'].includes(row.is_pair_massage?.toLowerCase() || ''),
        image_url: row.image_url || null,
        buffer_before: parseInt(row.buffer_before_minutes) || 0,
        buffer_after: parseInt(row.buffer_after_minutes) || 0,
        no_show_fee: Math.round((parseFloat(row.no_show_fee || row.no_show_fee_eur) || 0) * 100),
        late_cancel_fee: Math.round((parseFloat(row.late_cancel_fee || row.late_cancel_fee_eur) || 0) * 100),
        late_cancel_hours: parseInt(row.late_cancel_hours) || 24,
        durations
      });
    }

    return { services, errors };
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
      const { services, errors } = parseCSV(text);
      setParsedServices(services);
      setErrors(errors);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!businessId || parsedServices.length === 0) return;

    setStep('importing');
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < parsedServices.length; i++) {
      const service = parsedServices[i];
      try {
        // Insert service
        const { data: newService, error: serviceError } = await supabase
          .from('services')
          .insert({
            business_id: businessId,
            name: service.name,
            description: service.description,
            category: service.category,
            is_pair_massage: service.is_pair_massage,
            image_url: service.image_url,
            buffer_before: service.buffer_before,
            buffer_after: service.buffer_after,
            no_show_fee: service.no_show_fee,
            late_cancel_fee: service.late_cancel_fee,
            late_cancel_hours: service.late_cancel_hours,
            display_order: i
          })
          .select()
          .single();

        if (serviceError || !newService) {
          throw new Error(serviceError?.message || 'Failed to create service');
        }

        // Insert durations
        for (const duration of service.durations) {
          await supabase.from('service_durations').insert({
            business_id: businessId,
            service_id: newService.id,
            duration_minutes: duration.duration_minutes,
            price_cents: duration.price_cents
          });
        }

        success++;
      } catch (error) {
        console.error('Error importing service:', service.name, error);
        failed++;
      }

      setImportProgress(Math.round(((i + 1) / parsedServices.length) * 100));
    }

    setImportResults({ success, failed });
    setStep('complete');
  };

  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col rounded-xl shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{t.title}</h2>
            <p className="text-gray-600 mt-1">{t.subtitle}</p>
          </div>
          <button onClick={onClose} title={t.close} aria-label={t.close} className="text-gray-400 hover:text-gray-600 transition-colors">
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
                    <h3 className="font-medium text-blue-900">{t.templateTitle}</h3>
                    <p className="text-sm text-blue-700 mt-1">{t.templateHint}</p>
                    <button
                      onClick={downloadTemplate}
                      className="mt-3 inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t.downloadTemplate}</span>
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
                <p className="text-lg font-medium text-gray-700">{t.uploadPrompt}</p>
                <p className="text-sm text-gray-500 mt-2">{t.dragDrop}</p>
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
                <h4 className="font-medium text-gray-900 mb-2">{t.guideTitle}</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>{t.guideRequiredLabel}</strong> {t.guideRequired}</li>
                  <li>• <strong>{t.guidePairLabel}</strong> {t.guidePair}</li>
                  <li>• <strong>{t.guidePricesLabel}</strong> {fillText(t.guidePrices, { currency, symbol: currencySymbol })}</li>
                  <li>• <strong>{t.guideDurationsLabel}</strong> {t.guideDurations}</li>
                  <li>• <strong>{t.guideBuffersLabel}</strong> {t.guideBuffers}</li>
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
                      <h3 className="font-medium text-red-900">{t.validationErrors}</h3>
                      <ul className="text-sm text-red-700 mt-2 space-y-1">
                        {errors.map((error, i) => (
                          <li key={i}>• {fillText(t[error.key], { row: error.row ?? '', columns: error.columns ?? '' })}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {parsedServices.length > 0 && (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-900 font-medium">
                        {parsedServices.length === 1 ? t.readyOne : fillText(t.readyMany, { count: parsedServices.length })}
                      </span>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">{t.colName}</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">{t.colCategory}</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">{t.colDurations}</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">{t.colOptions}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {parsedServices.map((service, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{service.name}</td>
                            <td className="px-4 py-3 text-gray-600">{service.category}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {service.durations.map((d, j) => (
                                <span key={j} className="inline-block mr-2 mb-1 px-2 py-1 bg-gray-100 rounded text-xs">
                                  {fillText(t.minutesShort, { minutes: d.duration_minutes })} - {formatPrice(d.price_cents)}
                                </span>
                              ))}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {service.is_pair_massage && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{t.couples}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-lg font-medium text-gray-900">{t.importing}</p>
              <div className="mt-4 w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{fillText(t.percentComplete, { percent: importProgress })}</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t.complete}</h3>
              <p className="text-gray-600 mb-6">
                {importResults.success === 1 ? t.importedOne : fillText(t.importedMany, { count: importResults.success })}
                {importResults.failed > 0 && (
                  <span className="text-red-600"> {fillText(t.failedCount, { count: importResults.failed })}</span>
                )}
              </p>
              <button
                onClick={() => {
                  onImportComplete();
                  onClose();
                }}
                className="px-6 py-3 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors"
              >
                {t.done}
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
              {step === 'preview' ? t.back : t.cancel}
            </button>
            {step === 'preview' && parsedServices.length > 0 && (
              <button
                onClick={handleImport}
                className="px-6 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-colors"
              >
                {parsedServices.length === 1 ? t.importOne : fillText(t.importMany, { count: parsedServices.length })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
