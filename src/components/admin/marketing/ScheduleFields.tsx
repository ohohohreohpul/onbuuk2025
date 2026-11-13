import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { ADMIN_INPUT, ADMIN_SELECT } from '../adminUi';
import { MARKETING_TEXT } from './marketingText';
import { AUTOMATION_TEXT } from './automationText';
import type { CampaignDraft } from './marketingApi';

const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);
const HOURS = Array.from({ length: 16 }, (_, index) => index + 6);
const DAYS_BEFORE_OPTIONS = [0, 1, 3, 7, 14];
const WINBACK_OPTIONS = [30, 45, 60, 90, 120, 180, 365];
const REVIEW_AFTER_OPTIONS = [0, 1, 2, 3, 7];

interface ScheduleFieldsProps {
  draft: CampaignDraft;
  nextSend: string | null;
  update: (patch: Partial<CampaignDraft>) => void;
}

/** "When is it sent?" — depends on the kind: monthly day, one date, or a daily automation rule. */
export default function ScheduleFields({ draft, nextSend, update }: ScheduleFieldsProps) {
  const { t } = useAdminText(MARKETING_TEXT);
  const { t: a } = useAdminText(AUTOMATION_TEXT);

  const hourSelect = (
    <label><span className="mb-1 block text-xs text-stone-500">{t.hour}</span>
      <select value={draft.send_hour} onChange={(e) => update({ send_hour: Number(e.target.value) })} className={ADMIN_SELECT}>
        {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
      </select>
    </label>
  );

  const ruleField = {
    monthly: (
      <label><span className="mb-1 block text-xs text-stone-500">{t.dayOfMonth}</span>
        <select value={draft.day_of_month} onChange={(e) => update({ day_of_month: Number(e.target.value) })} className={ADMIN_SELECT}>
          {DAYS.map((day) => <option key={day} value={day}>{day}.</option>)}
        </select>
      </label>
    ),
    special_day: (
      <label><span className="mb-1 block text-xs text-stone-500">{a.sendDate}</span>
        <input type="date" value={draft.send_on ?? ''} onChange={(e) => update({ send_on: e.target.value || null })} className={ADMIN_INPUT} />
      </label>
    ),
    birthday: (
      <label><span className="mb-1 block text-xs text-stone-500">{a.daysBefore}</span>
        <select value={draft.days_before} onChange={(e) => update({ days_before: Number(e.target.value) })} className={ADMIN_SELECT}>
          {DAYS_BEFORE_OPTIONS.map((days) => <option key={days} value={days}>{days === 0 ? a.onTheDay : fillText(a.daysBeforeOption, { days })}</option>)}
        </select>
      </label>
    ),
    winback: (
      <label><span className="mb-1 block text-xs text-stone-500">{a.winbackAfter}</span>
        <select value={draft.winback_days} onChange={(e) => update({ winback_days: Number(e.target.value) })} className={ADMIN_SELECT}>
          {WINBACK_OPTIONS.map((days) => <option key={days} value={days}>{fillText(a.winbackOption, { days })}</option>)}
        </select>
      </label>
    ),
    review_request: (
      <label><span className="mb-1 block text-xs text-stone-500">{a.reviewAfter}</span>
        <select value={draft.days_after} onChange={(e) => update({ days_after: Number(e.target.value) })} className={ADMIN_SELECT}>
          {REVIEW_AFTER_OPTIONS.map((days) => <option key={days} value={days}>{days === 0 ? a.reviewSameDay : fillText(a.reviewAfterOption, { days })}</option>)}
        </select>
      </label>
    ),
  }[draft.kind];

  const toggleLabel = { monthly: t.monthlyOn, special_day: a.specialOn, birthday: a.automationOn, winback: a.automationOn, review_request: a.automationOn }[draft.kind];
  const hint = {
    monthly: t.monthlyHint, special_day: a.specialScheduleHint, birthday: a.birthdayScheduleHint, winback: a.winbackScheduleHint, review_request: a.reviewScheduleHint,
  }[draft.kind];

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium text-stone-700">{t.schedule}</legend>
      <div className="grid grid-cols-2 gap-2">
        {ruleField}
        {hourSelect}
      </div>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={draft.is_active} onChange={(e) => update({ is_active: e.target.checked })} className="h-4 w-4 accent-[#1A1714]" />
        <span className="text-sm font-medium text-[#1A1714]">{toggleLabel}</span>
      </label>
      <p className="text-xs text-stone-500">{hint}</p>
      {nextSend && <p className="text-xs font-medium text-emerald-700">{fillText(t.nextSend, { date: nextSend })}</p>}
    </fieldset>
  );
}
