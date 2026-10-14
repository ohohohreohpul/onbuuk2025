import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { defaultBlockRange, fromDateTimeLocalValue, toDateTimeLocalValue } from '../../lib/localDateTime';
import { useAdminText } from '../../lib/adminLanguage';
import { Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  titleShop: string; titleBlocks: string; close: string; loading: string;
  emptyShop: string; emptyBlocks: string; reasonPlaceholder: string; remove: string;
  start: string; end: string; addShop: string; addBlock: string; note: string; noteShop: string; noteBlocks: string;
  defaultReasonShop: string; defaultReasonBlock: string;
  errorLoad: string; errorDelete: string; errorRange: string; errorSave: string;
  cancel: string; save: string; saving: string;
}> = {
  en: {
    titleShop: 'Shop closed days', titleBlocks: 'Time Blocks', close: 'Close', loading: 'Loading...',
    emptyShop: 'No closed days planned. Add holidays or company vacation below.',
    emptyBlocks: 'No time blocks scheduled. Add vacation or unavailable periods below.',
    reasonPlaceholder: 'Reason (e.g., Vacation, Sick Leave)', remove: 'Remove',
    start: 'Start Date & Time', end: 'End Date & Time', addShop: 'Add closed days', addBlock: 'Add Time Block',
    note: 'Note:',
    noteShop: 'Nobody can book while the shop is closed, online or through AI assistants. Existing bookings stay as they are.',
    noteBlocks: 'Time blocks prevent bookings during specified periods. Use this for vacations, holidays, or other unavailable times.',
    defaultReasonShop: 'Closed', defaultReasonBlock: 'Time Off',
    errorLoad: 'Could not load the blocked times. Please try again.',
    errorDelete: 'Could not delete this entry. Please try again.',
    errorRange: 'Every entry needs a start and an end, and the end must be after the start.',
    errorSave: 'Could not save. Please check the entries and try again.',
    cancel: 'Cancel', save: 'Save', saving: 'Saving...',
  },
  de: {
    titleShop: 'Schließtage', titleBlocks: 'Blockzeiten', close: 'Schließen', loading: 'Wird geladen...',
    emptyShop: 'Keine Schließtage geplant. Feiertage oder Betriebsurlaub unten hinzufügen.',
    emptyBlocks: 'Keine Blockzeiten geplant. Urlaub oder Abwesenheiten unten hinzufügen.',
    reasonPlaceholder: 'Grund (z. B. Urlaub, Krankheit)', remove: 'Entfernen',
    start: 'Beginn (Datum & Uhrzeit)', end: 'Ende (Datum & Uhrzeit)', addShop: 'Schließtage hinzufügen', addBlock: 'Blockzeit hinzufügen',
    note: 'Hinweis:',
    noteShop: 'Während der Schließung kann niemand buchen – weder online noch über KI-Assistenten. Bestehende Buchungen bleiben unverändert.',
    noteBlocks: 'Blockzeiten verhindern Buchungen im angegebenen Zeitraum. Für Urlaub, Feiertage oder andere Abwesenheiten.',
    defaultReasonShop: 'Geschlossen', defaultReasonBlock: 'Abwesend',
    errorLoad: 'Blockzeiten konnten nicht geladen werden. Bitte erneut versuchen.',
    errorDelete: 'Eintrag konnte nicht gelöscht werden. Bitte erneut versuchen.',
    errorRange: 'Jeder Eintrag braucht Beginn und Ende, und das Ende muss nach dem Beginn liegen.',
    errorSave: 'Speichern fehlgeschlagen. Bitte Einträge prüfen und erneut versuchen.',
    cancel: 'Abbrechen', save: 'Speichern', saving: 'Wird gespeichert...',
  },
  th: {
    titleShop: 'วันปิดร้าน', titleBlocks: 'ช่วงเวลาปิดรับจอง', close: 'ปิด', loading: 'กำลังโหลด...',
    emptyShop: 'ยังไม่มีวันปิดร้าน เพิ่มวันหยุดหรือวันหยุดร้านด้านล่าง',
    emptyBlocks: 'ยังไม่มีช่วงเวลาปิดรับจอง เพิ่มวันลาหรือช่วงที่ไม่ว่างด้านล่าง',
    reasonPlaceholder: 'เหตุผล (เช่น ลาพักร้อน ลาป่วย)', remove: 'ลบ',
    start: 'วันและเวลาเริ่ม', end: 'วันและเวลาสิ้นสุด', addShop: 'เพิ่มวันปิดร้าน', addBlock: 'เพิ่มช่วงเวลาปิดรับจอง',
    note: 'หมายเหตุ:',
    noteShop: 'ระหว่างที่ร้านปิด จะไม่มีใครจองได้ ทั้งทางออนไลน์และผ่านผู้ช่วย AI การจองที่มีอยู่แล้วจะไม่เปลี่ยนแปลง',
    noteBlocks: 'ช่วงเวลาปิดรับจองจะป้องกันการจองในช่วงที่กำหนด ใช้สำหรับวันลา วันหยุด หรือช่วงที่ไม่ว่าง',
    defaultReasonShop: 'ปิดร้าน', defaultReasonBlock: 'ลาหยุด',
    errorLoad: 'โหลดช่วงเวลาปิดรับจองไม่สำเร็จ กรุณาลองอีกครั้ง',
    errorDelete: 'ลบรายการนี้ไม่สำเร็จ กรุณาลองอีกครั้ง',
    errorRange: 'ทุกรายการต้องมีเวลาเริ่มและสิ้นสุด และเวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม',
    errorSave: 'บันทึกไม่สำเร็จ กรุณาตรวจสอบรายการแล้วลองอีกครั้ง',
    cancel: 'ยกเลิก', save: 'บันทึก', saving: 'กำลังบันทึก...',
  },
};

interface TimeBlocksModalProps {
  /** null = whole-shop closures (holidays, Betriebsurlaub). */
  specialistId: string | null;
  specialistName: string;
  onClose: () => void;
}

/** start_time / end_time hold datetime-local values (local wall-clock). */
interface TimeBlock {
  id?: string;
  start_time: string;
  end_time: string;
  reason: string;
}

interface TimeBlockRow {
  id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export default function TimeBlocksModal({ specialistId, specialistName, onClose }: TimeBlocksModalProps) {
  const { t } = useAdminText(TEXT);
  const { businessId } = useTenant();
  const isShopClosure = specialistId === null;
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeBlocks();
  }, [specialistId, businessId]);

  const fetchTimeBlocks = async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    const base = supabase
      .from('time_blocks')
      .select('id, start_time, end_time, reason')
      .eq('business_id', businessId)
      .gte('end_time', new Date().toISOString())
      .order('start_time');
    const { data, error: loadError } = isShopClosure
      ? await base.is('specialist_id', null)
      : await base.eq('specialist_id', specialistId);

    if (loadError) {
      console.error('Error loading time blocks:', loadError);
      setError(t.errorLoad);
    }
    setTimeBlocks(((data || []) as TimeBlockRow[]).map((row) => ({
      id: row.id,
      start_time: toDateTimeLocalValue(row.start_time),
      end_time: toDateTimeLocalValue(row.end_time),
      reason: row.reason ?? '',
    })));
    setLoading(false);
  };

  const addTimeBlock = () => {
    const { start, end } = defaultBlockRange(new Date(), { wholeDay: isShopClosure });
    setTimeBlocks((prev) => [
      ...prev,
      { start_time: start, end_time: end, reason: isShopClosure ? t.defaultReasonShop : t.defaultReasonBlock },
    ]);
  };

  const updateTimeBlock = (index: number, field: keyof TimeBlock, value: string) => {
    setTimeBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, [field]: value } : block))
    );
  };

  const removeTimeBlock = async (index: number) => {
    const block = timeBlocks[index];
    if (block.id) {
      const { error: deleteError } = await supabase.from('time_blocks').delete().eq('id', block.id);
      if (deleteError) {
        console.error('Error deleting time block:', deleteError);
        setError(t.errorDelete);
        return;
      }
    }
    setTimeBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!businessId) return;
    setError(null);

    const rows = timeBlocks.map((block) => ({
      block,
      start: fromDateTimeLocalValue(block.start_time),
      end: fromDateTimeLocalValue(block.end_time),
    }));
    if (rows.some(({ start, end }) => !start || !end || end <= start)) {
      setError(t.errorRange);
      return;
    }

    setSaving(true);
    try {
      for (const { block, start, end } of rows) {
        const blockData = {
          business_id: businessId,
          specialist_id: specialistId,
          start_time: start,
          end_time: end,
          reason: block.reason.trim() || null,
        };
        const { error: saveError } = block.id
          ? await supabase.from('time_blocks').update(blockData).eq('id', block.id)
          : await supabase.from('time_blocks').insert(blockData);
        if (saveError) throw saveError;
      }
      onClose();
    } catch (saveError) {
      console.error('Error saving time blocks:', saveError);
      setError(t.errorSave);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-stone-700" />
            <div>
              <h2 className="text-xl font-semibold text-stone-900">{isShopClosure ? t.titleShop : t.titleBlocks}</h2>
              <p className="text-sm text-stone-600">{specialistName}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t.close} title={t.close} className="text-stone-400 hover:text-stone-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8 text-stone-500">{t.loading}</div>
          ) : (
            <>
              <div className="space-y-4">
                {timeBlocks.length === 0 ? (
                  <div className="text-center py-8 text-stone-500">
                    {isShopClosure
                      ? t.emptyShop
                      : t.emptyBlocks}
                  </div>
                ) : (
                  timeBlocks.map((block, index) => (
                    <div
                      key={index}
                      className="p-4 border border-stone-200 rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <input
                          type="text"
                          value={block.reason}
                          onChange={(e) => updateTimeBlock(index, 'reason', e.target.value)}
                          placeholder={t.reasonPlaceholder}
                          className="flex-1 px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                        />
                        <button
                          onClick={() => removeTimeBlock(index)}
                          aria-label={t.remove}
                          title={t.remove}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            {t.start}
                          </label>
                          <input
                            type="datetime-local"
                            value={block.start_time}
                            onChange={(e) => updateTimeBlock(index, 'start_time', e.target.value)}
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-700 mb-1">
                            {t.end}
                          </label>
                          <input
                            type="datetime-local"
                            value={block.end_time}
                            onChange={(e) => updateTimeBlock(index, 'end_time', e.target.value)}
                            className="w-full px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={addTimeBlock}
                className="mt-4 w-full py-3 border-2 border-dashed border-stone-300 text-stone-600 hover:border-stone-400 hover:text-stone-700 transition-colors rounded-lg flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>{isShopClosure ? t.addShop : t.addBlock}</span>
              </button>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>{t.note}</strong>{' '}
                  {isShopClosure
                    ? t.noteShop
                    : t.noteBlocks}
                </p>
              </div>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mx-6 mb-0 mt-0 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        <div className="p-6 border-t border-stone-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
