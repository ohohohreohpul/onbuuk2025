import { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useAdminText } from '../../lib/adminLanguage';
import { Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  title: string; close: string; to: string; unavailable: string; tip: string; tipBody: string;
  saveFailed: string; cancel: string; saving: string; saveHours: string;
}> = {
  en: {
    title: 'Working Hours', close: 'Close', to: 'to', unavailable: 'Unavailable', tip: 'Tip:',
    tipBody: 'Uncheck a day to mark it as unavailable. Times will be ignored for unchecked days.',
    saveFailed: 'Failed to save working hours', cancel: 'Cancel', saving: 'Saving...', saveHours: 'Save Hours',
  },
  de: {
    title: 'Arbeitszeiten', close: 'Schließen', to: 'bis', unavailable: 'Nicht verfügbar', tip: 'Tipp:',
    tipBody: 'Haken entfernen, um einen Tag als nicht verfügbar zu markieren. Zeiten an diesen Tagen werden ignoriert.',
    saveFailed: 'Arbeitszeiten konnten nicht gespeichert werden', cancel: 'Abbrechen', saving: 'Wird gespeichert...', saveHours: 'Arbeitszeiten speichern',
  },
  th: {
    title: 'เวลาทำงาน', close: 'ปิด', to: 'ถึง', unavailable: 'ไม่ว่าง', tip: 'เคล็ดลับ:',
    tipBody: 'เอาเครื่องหมายถูกออกเพื่อตั้งวันนั้นเป็นวันไม่ว่าง ระบบจะไม่ใช้เวลาของวันที่ไม่ได้เลือก',
    saveFailed: 'บันทึกเวลาทำงานไม่สำเร็จ', cancel: 'ยกเลิก', saving: 'กำลังบันทึก...', saveHours: 'บันทึกเวลาทำงาน',
  },
};

const DAY_COUNT = 7;

/** Full weekday name for day_of_week (0 = Sunday) in the admin's locale. */
const weekdayName = (dayOfWeek: number, locale: string): string =>
  new Date(2024, 0, 7 + dayOfWeek).toLocaleDateString(locale, { weekday: 'long' });

interface WorkingHoursModalProps {
  specialistId: string;
  specialistName: string;
  onClose: () => void;
}

interface WorkingHour {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export default function WorkingHoursModal({ specialistId, specialistName, onClose }: WorkingHoursModalProps) {
  const { t, locale } = useAdminText(TEXT);
  const { businessId } = useTenant();
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkingHours();
  }, [specialistId]);

  const fetchWorkingHours = async () => {
    const { data } = await supabase
      .from('working_hours')
      .select('*')
      .eq('specialist_id', specialistId)
      .order('day_of_week');

    if (data && data.length > 0) {
      setWorkingHours(data);
    } else {
      setWorkingHours(
        Array.from({ length: DAY_COUNT }, (_, index) => ({
          day_of_week: index,
          start_time: '09:00',
          end_time: '17:00',
          is_available: index >= 1 && index <= 5,
        }))
      );
    }
  };

  const updateDay = (dayIndex: number, field: keyof WorkingHour, value: string | boolean) => {
    setWorkingHours((prev) =>
      prev.map((wh) =>
        wh.day_of_week === dayIndex ? { ...wh, [field]: value } : wh
      )
    );
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);

    try {
      await supabase
        .from('working_hours')
        .delete()
        .eq('specialist_id', specialistId);

      const hoursToInsert = workingHours.map((wh) => ({
        business_id: businessId,
        specialist_id: specialistId,
        day_of_week: wh.day_of_week,
        start_time: wh.start_time,
        end_time: wh.end_time,
        is_available: wh.is_available,
      }));

      const { error } = await supabase
        .from('working_hours')
        .insert(hoursToInsert);

      if (error) throw error;

      onClose();
    } catch (error) {
      console.error('Error saving working hours:', error);
      alert(t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="w-6 h-6 text-stone-700" />
            <div>
              <h2 className="text-xl font-semibold text-stone-900">{t.title}</h2>
              <p className="text-sm text-stone-600">{specialistName}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t.close} title={t.close} className="text-stone-400 hover:text-stone-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {workingHours.map((wh) => (
              <div
                key={wh.day_of_week}
                className="flex items-center space-x-4 pb-4 border-b border-stone-100"
              >
                <div className="w-32">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={wh.is_available}
                      onChange={(e) => updateDay(wh.day_of_week, 'is_available', e.target.checked)}
                      className="rounded border-stone-300"
                    />
                    <span className="text-sm font-medium text-stone-700">
                      {weekdayName(wh.day_of_week, locale)}
                    </span>
                  </label>
                </div>

                <div className="flex items-center space-x-2 flex-1">
                  <input
                    type="time"
                    value={wh.start_time}
                    onChange={(e) => updateDay(wh.day_of_week, 'start_time', e.target.value)}
                    disabled={!wh.is_available}
                    className="px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 disabled:bg-stone-50 disabled:text-stone-400"
                  />
                  <span className="text-stone-500">{t.to}</span>
                  <input
                    type="time"
                    value={wh.end_time}
                    onChange={(e) => updateDay(wh.day_of_week, 'end_time', e.target.value)}
                    disabled={!wh.is_available}
                    className="px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 disabled:bg-stone-50 disabled:text-stone-400"
                  />
                </div>

                {!wh.is_available && (
                  <span className="text-xs text-stone-400">{t.unavailable}</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{t.tip}</strong> {t.tipBody}
            </p>
          </div>
        </div>

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
            {saving ? t.saving : t.saveHours}
          </button>
        </div>
      </div>
    </div>
  );
}
