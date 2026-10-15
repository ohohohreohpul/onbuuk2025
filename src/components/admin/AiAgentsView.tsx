import { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, AlertCircle, ChevronDown, CheckCircle2, Hand, Loader2 } from 'lucide-react';
import { ADMIN_SURFACE, ADMIN_INPUT, ADMIN_SELECT, ADMIN_STATUS_PILL } from './adminUi';
import { useTenant } from '../../lib/tenantContext';
import {
  getAgentSettings,
  updateAgentSettings,
  listAgentKeys,
  listAgentBookings,
  listAgentEvents,
  type AgentSettings,
  type AgentKeyRow,
  type AgentBookingRow,
  type AgentEventRow,
} from '../../lib/agentAdminApi';
import AgentKeysPanel from './agents/AgentKeysPanel';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';

// Merchant "AI Agents" page — designed (per Jev, docs/DECISIONS.md) for busy,
// non-technical owners: one switch, two plain choices, everything else under
// "Advanced". Every control saves immediately; there is no Save button to forget.

type AiText = {
  loading: string; title: string; intro: string; loadFailed: string; saveFailed: string;
  switchHeading: string; switchOn: string; switchOff: string; saving: string; saved: string;
  policyHeading: string; autoTitle: string; autoBody: string; manualTitle: string; manualBody: string;
  findHeading: string; businessKind: string; choose: string; city: string; cityPlaceholder: string;
  bookingsHeading: string; noneYet: string; customer: string; via: string; assistant: string;
  statusConfirmed: string; statusPending: string; statusCancelled: string;
  advanced: string; leadTime: string; holdTime: string; description: string; descriptionPlaceholder: string;
  activity: string; noActivity: string;
  typeSalon: string; typeBarber: string; typeBeauty: string; typeWellness: string; typeFitness: string; typeClinic: string; typeOther: string;
};

const TEXT: Translations<AiText> = {
  en: {
    loading: 'Loading…', title: 'AI booking', intro: 'Let people book you by asking ChatGPT, Siri or other AI assistants.',
    loadFailed: 'Could not load this page. Please refresh.', saveFailed: 'Could not save. Please try again.',
    switchHeading: 'Let AI assistants book appointments', switchOn: 'On — assistants can see your free times and book them.',
    switchOff: 'Off — assistants cannot book you yet.', saving: 'Saving…', saved: 'Saved',
    policyHeading: 'When an assistant books', autoTitle: 'Accept automatically',
    autoBody: 'The booking goes straight into your calendar, like a normal online booking. You get an email.',
    manualTitle: 'Approve each booking myself', manualBody: 'You get an email with one button to approve or decline.',
    findHeading: 'So assistants can find you', businessKind: 'What kind of business?', choose: 'Choose…', city: 'City', cityPlaceholder: 'Hamburg',
    bookingsHeading: 'Bookings from assistants', noneYet: 'None yet.', customer: 'Customer', via: 'via {agent}', assistant: 'assistant',
    statusConfirmed: 'confirmed', statusPending: 'pending', statusCancelled: 'cancelled',
    advanced: 'Advanced', leadTime: 'Earliest booking (minutes from now)', holdTime: 'Hold a time while customer decides (seconds)',
    description: 'Short description for assistants', descriptionPlaceholder: 'e.g. Friendly neighbourhood salon in Eimsbüttel, specialising in colour.',
    activity: 'Activity', noActivity: 'No activity yet.',
    typeSalon: 'Hair salon', typeBarber: 'Barber', typeBeauty: 'Beauty / nails / cosmetics', typeWellness: 'Massage / wellness / spa',
    typeFitness: 'Fitness / personal training', typeClinic: 'Clinic / therapy', typeOther: 'Something else',
  },
  de: {
    loading: 'Wird geladen…', title: 'KI-Buchung', intro: 'Kund:innen buchen Sie über ChatGPT, Siri oder andere KI-Assistenten.',
    loadFailed: 'Seite konnte nicht geladen werden. Bitte neu laden.', saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    switchHeading: 'KI-Assistenten dürfen Termine buchen', switchOn: 'An – Assistenten sehen Ihre freien Zeiten und können sie buchen.',
    switchOff: 'Aus – Assistenten können noch nicht buchen.', saving: 'Wird gespeichert…', saved: 'Gespeichert',
    policyHeading: 'Wenn ein Assistent bucht', autoTitle: 'Automatisch annehmen',
    autoBody: 'Die Buchung landet direkt in Ihrem Kalender, wie eine normale Online-Buchung. Sie erhalten eine E-Mail.',
    manualTitle: 'Jede Buchung selbst bestätigen', manualBody: 'Sie erhalten eine E-Mail mit einem Button zum Annehmen oder Ablehnen.',
    findHeading: 'Damit Assistenten Sie finden', businessKind: 'Art des Betriebs', choose: 'Auswählen…', city: 'Stadt', cityPlaceholder: 'Hamburg',
    bookingsHeading: 'Buchungen über Assistenten', noneYet: 'Noch keine.', customer: 'Kund:in', via: 'über {agent}', assistant: 'Assistent',
    statusConfirmed: 'bestätigt', statusPending: 'ausstehend', statusCancelled: 'storniert',
    advanced: 'Erweitert', leadTime: 'Früheste Buchung (Minuten ab jetzt)', holdTime: 'Termin reservieren, während Kund:in entscheidet (Sekunden)',
    description: 'Kurzbeschreibung für Assistenten', descriptionPlaceholder: 'z. B. Freundlicher Salon in Eimsbüttel, spezialisiert auf Coloration.',
    activity: 'Aktivität', noActivity: 'Noch keine Aktivität.',
    typeSalon: 'Friseursalon', typeBarber: 'Barbershop', typeBeauty: 'Beauty / Nägel / Kosmetik', typeWellness: 'Massage / Wellness / Spa',
    typeFitness: 'Fitness / Personal Training', typeClinic: 'Praxis / Therapie', typeOther: 'Etwas anderes',
  },
  th: {
    loading: 'กำลังโหลด…', title: 'การจองผ่าน AI', intro: 'ให้ลูกค้าจองกับคุณผ่าน ChatGPT, Siri หรือผู้ช่วย AI อื่นๆ',
    loadFailed: 'โหลดหน้านี้ไม่สำเร็จ กรุณารีเฟรช', saveFailed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง',
    switchHeading: 'ให้ผู้ช่วย AI จองนัดหมายได้', switchOn: 'เปิด — ผู้ช่วยเห็นเวลาว่างของคุณและจองได้',
    switchOff: 'ปิด — ผู้ช่วยยังจองไม่ได้', saving: 'กำลังบันทึก…', saved: 'บันทึกแล้ว',
    policyHeading: 'เมื่อผู้ช่วยทำการจอง', autoTitle: 'รับการจองอัตโนมัติ',
    autoBody: 'การจองเข้าปฏิทินของคุณทันที เหมือนการจองออนไลน์ทั่วไป และคุณจะได้รับอีเมล',
    manualTitle: 'อนุมัติทุกการจองด้วยตัวเอง', manualBody: 'คุณจะได้รับอีเมลพร้อมปุ่มเดียวเพื่ออนุมัติหรือปฏิเสธ',
    findHeading: 'เพื่อให้ผู้ช่วยค้นหาคุณเจอ', businessKind: 'ธุรกิจประเภทใด', choose: 'เลือก…', city: 'เมือง', cityPlaceholder: 'Hamburg',
    bookingsHeading: 'การจองจากผู้ช่วย AI', noneYet: 'ยังไม่มี', customer: 'ลูกค้า', via: 'ผ่าน {agent}', assistant: 'ผู้ช่วย',
    statusConfirmed: 'ยืนยันแล้ว', statusPending: 'รอดำเนินการ', statusCancelled: 'ยกเลิกแล้ว',
    advanced: 'ขั้นสูง', leadTime: 'จองล่วงหน้าอย่างน้อย (นาทีจากตอนนี้)', holdTime: 'กันเวลาไว้ระหว่างที่ลูกค้าตัดสินใจ (วินาที)',
    description: 'คำอธิบายสั้นๆ สำหรับผู้ช่วย AI', descriptionPlaceholder: 'เช่น ร้านทำผมบรรยากาศเป็นกันเองใน Eimsbüttel เชี่ยวชาญด้านทำสีผม',
    activity: 'กิจกรรม', noActivity: 'ยังไม่มีกิจกรรม',
    typeSalon: 'ร้านทำผม', typeBarber: 'ร้านตัดผมชาย', typeBeauty: 'ความงาม / ทำเล็บ / เครื่องสำอาง', typeWellness: 'นวด / เวลเนส / สปา',
    typeFitness: 'ฟิตเนส / เทรนเนอร์ส่วนตัว', typeClinic: 'คลินิก / บำบัด', typeOther: 'อื่นๆ',
  },
};

const BUSINESS_TYPES: { value: string; labelKey: keyof AiText }[] = [
  { value: 'salon', labelKey: 'typeSalon' },
  { value: 'barber', labelKey: 'typeBarber' },
  { value: 'beauty', labelKey: 'typeBeauty' },
  { value: 'wellness', labelKey: 'typeWellness' },
  { value: 'fitness', labelKey: 'typeFitness' },
  { value: 'clinic', labelKey: 'typeClinic' },
  { value: 'other', labelKey: 'typeOther' },
];

const STATUS_LABEL_KEY: Record<string, keyof AiText> = {
  confirmed: 'statusConfirmed',
  pending: 'statusPending',
  cancelled: 'statusCancelled',
};

const DEFAULT_SETTINGS: AgentSettings = {
  agent_enabled: false,
  agent_consent_policy: 'auto',
  agent_lead_time_minutes: 120,
  agent_slot_hold_seconds: 600,
  vertical: null,
  city: null,
  address_line: null,
  agent_description: null,
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-stone-100 text-stone-500',
};

interface PolicyCardProps {
  isSelected: boolean;
  title: string;
  body: string;
  icon: typeof CheckCircle2;
  onSelect: () => void;
}

function PolicyCard({ isSelected, title, body, icon: Icon, onSelect }: PolicyCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={`flex w-full items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
        isSelected
          ? 'border-[#1A1714] bg-stone-50 shadow-[0_8px_24px_-12px_rgba(26,23,20,0.4)]'
          : 'border-stone-200 hover:border-stone-400'
      }`}
    >
      <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-stone-400'}`} aria-hidden />
      <span>
        <span className="block text-lg font-semibold text-[#1A1714]">{title}</span>
        <span className="mt-1 block text-base text-stone-600">{body}</span>
      </span>
    </button>
  );
}

export default function AiAgentsView() {
  const { t, locale } = useAdminText(TEXT);
  const textRef = useRef(t);
  textRef.current = t;
  const { businessId } = useTenant();
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [keys, setKeys] = useState<AgentKeyRow[]>([]);
  const [bookings, setBookings] = useState<AgentBookingRow[]>([]);
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [s, k, b, e] = await Promise.all([
        getAgentSettings(),
        listAgentKeys(),
        listAgentBookings(),
        listAgentEvents(),
      ]);
      setSettings(s.settings ?? DEFAULT_SETTINGS);
      setKeys(k.keys ?? []);
      setBookings(b.bookings ?? []);
      setEvents(e.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : textRef.current.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (businessId) refreshAll();
  }, [businessId, refreshAll]);

  // Optimistic save: show the change at once, roll back if the server refuses.
  const save = async (patch: Partial<AgentSettings>) => {
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setIsSaving(true);
    setError(null);
    try {
      const { settings: updated } = await updateAgentSettings(patch);
      setSettings(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setSettings(previous);
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24 text-stone-500">{t.loading}</div>;
  }

  const isOn = settings.agent_enabled;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <header>
        <div className="flex items-center gap-2.5">
          <Bot className="h-7 w-7 text-[#1A1714]" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight text-[#1A1714]">{t.title}</h1>
        </div>
        <p className="mt-2 text-lg text-stone-600">
          {t.intro}
        </p>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <section className={`${ADMIN_SURFACE} p-6`} aria-labelledby="ai-switch-heading">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h2 id="ai-switch-heading" className="text-xl font-semibold text-[#1A1714]">
              {t.switchHeading}
            </h2>
            <p className="mt-1 text-base text-stone-600">
              {isOn ? t.switchOn : t.switchOff}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-labelledby="ai-switch-heading"
            onClick={() => save({ agent_enabled: !isOn })}
            className={`relative h-12 w-[88px] shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${
              isOn ? 'bg-emerald-600' : 'bg-stone-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-10 w-10 rounded-full bg-white shadow transition-transform duration-200 ${
                isOn ? 'translate-x-10' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="mt-3 h-5 text-sm text-stone-400" aria-live="polite">
          {isSaving ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t.saving}</span>
          ) : savedAt ? t.saved : ''}
        </p>
      </section>

      <section className={`${ADMIN_SURFACE} p-6`} aria-labelledby="ai-policy-heading">
        <h2 id="ai-policy-heading" className="text-xl font-semibold text-[#1A1714]">
          {t.policyHeading}
        </h2>
        <div role="radiogroup" aria-labelledby="ai-policy-heading" className="mt-4 grid gap-3">
          <PolicyCard
            isSelected={settings.agent_consent_policy === 'auto'}
            title={t.autoTitle}
            body={t.autoBody}
            icon={CheckCircle2}
            onSelect={() => save({ agent_consent_policy: 'auto' })}
          />
          <PolicyCard
            isSelected={settings.agent_consent_policy === 'manual'}
            title={t.manualTitle}
            body={t.manualBody}
            icon={Hand}
            onSelect={() => save({ agent_consent_policy: 'manual' })}
          />
        </div>
      </section>

      <section className={`${ADMIN_SURFACE} p-6`} aria-labelledby="ai-find-heading">
        <h2 id="ai-find-heading" className="text-xl font-semibold text-[#1A1714]">
          {t.findHeading}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-base font-medium text-stone-700">{t.businessKind}</span>
            <select
              className={ADMIN_SELECT}
              value={settings.vertical ?? ''}
              onChange={(e) => save({ vertical: e.target.value || null })}
            >
              <option value="">{t.choose}</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{t[type.labelKey]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-base font-medium text-stone-700">{t.city}</span>
            <input
              className={ADMIN_INPUT}
              placeholder={t.cityPlaceholder}
              defaultValue={settings.city ?? ''}
              onBlur={(e) => {
                const city = e.target.value.trim() || null;
                if (city !== settings.city) save({ city });
              }}
            />
          </label>
        </div>
      </section>

      <section className={`${ADMIN_SURFACE} p-6`} aria-labelledby="ai-bookings-heading">
        <h2 id="ai-bookings-heading" className="text-xl font-semibold text-[#1A1714]">
          {t.bookingsHeading}
        </h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {bookings.length === 0 && (
            <li className="py-6 text-center text-base text-stone-400">{t.noneYet}</li>
          )}
          {bookings.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-base font-medium text-[#1A1714]">{b.bookings?.customer_name ?? t.customer}</div>
                <div className="text-sm text-stone-500">
                  {b.bookings?.booking_date} · {b.bookings?.start_time?.slice(0, 5)} · {fillText(t.via, { agent: b.agent_name ?? t.assistant })}
                </div>
              </div>
              <span className={`${ADMIN_STATUS_PILL} ${STATUS_STYLE[b.bookings?.status ?? ''] ?? 'bg-stone-100 text-stone-500'}`}>
                {b.bookings?.status ? (STATUS_LABEL_KEY[b.bookings.status] ? t[STATUS_LABEL_KEY[b.bookings.status]] : b.bookings.status) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <details className={`${ADMIN_SURFACE} group p-6`}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-stone-600">
          {t.advanced}
          <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-5 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-stone-700">{t.leadTime}</span>
              <input
                type="number"
                min={0}
                className={ADMIN_INPUT}
                defaultValue={settings.agent_lead_time_minutes}
                onBlur={(e) => save({ agent_lead_time_minutes: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-stone-700">{t.holdTime}</span>
              <input
                type="number"
                min={60}
                className={ADMIN_INPUT}
                defaultValue={settings.agent_slot_hold_seconds}
                onBlur={(e) => save({ agent_slot_hold_seconds: Math.max(60, Number(e.target.value) || 600) })}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-stone-700">{t.description}</span>
              <textarea
                className={`${ADMIN_INPUT} min-h-[80px] resize-y`}
                placeholder={t.descriptionPlaceholder}
                defaultValue={settings.agent_description ?? ''}
                onBlur={(e) => {
                  const text = e.target.value.trim() || null;
                  if (text !== settings.agent_description) save({ agent_description: text });
                }}
              />
            </label>
          </div>

          <AgentKeysPanel keys={keys} onKeysChange={setKeys} onError={setError} />

          <div>
            <h3 className="text-sm font-semibold text-[#1A1714]">{t.activity}</h3>
            <ul className="mt-2 divide-y divide-stone-100">
              {events.length === 0 && <li className="py-3 text-sm text-stone-400">{t.noActivity}</li>}
              {events.slice(0, 20).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[#1A1714]">
                    {ev.action}
                    {ev.result && <span className="text-stone-400"> → {ev.result}</span>}
                  </span>
                  <span className="text-xs text-stone-400">{new Date(ev.created_at).toLocaleString(locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
