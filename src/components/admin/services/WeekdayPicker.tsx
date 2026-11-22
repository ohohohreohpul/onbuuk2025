import { useAdminText } from '../../../lib/adminLanguage';
import type { Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{ label: string; hint: string; days: string }> = {
  en: { label: 'Bookable on', hint: 'Nothing selected = every day the therapists work.', days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun' },
  de: { label: 'Buchbar an', hint: 'Nichts ausgewählt = an allen Tagen, an denen die Therapeut:innen arbeiten.', days: 'Mo,Di,Mi,Do,Fr,Sa,So' },
  th: { label: 'จองได้วัน', hint: 'ไม่เลือก = ทุกวันที่พนักงานทำงาน', days: 'จ.,อ.,พ.,พฤ.,ศ.,ส.,อา.' },
};

/** Monday first on screen; stored as day_of_week (0 = Sunday … 6 = Saturday). */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface WeekdayPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
}

/** Weekdays a service can be booked online (e.g. Deep Bodywork: Thu–Sat). */
export default function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  const { t } = useAdminText(TEXT);
  const toggle = (day: number) => onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());

  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-stone-700">{t.label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {DAY_ORDER.map((day, index) => {
          const isOn = value.includes(day);
          return (
            <button key={day} type="button" aria-pressed={isOn} onClick={() => toggle(day)}
              className={`h-10 min-w-12 rounded-xl px-3 text-sm font-medium transition ${isOn ? 'bg-[#1A1714] text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}>
              {t.days.split(',')[index]}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-stone-500">{t.hint}</p>
    </fieldset>
  );
}
