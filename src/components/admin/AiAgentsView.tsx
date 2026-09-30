import { useState, useEffect, useCallback } from 'react';
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

// Merchant "AI Agents" page — designed (per Jev, docs/DECISIONS.md) for busy,
// non-technical owners: one switch, two plain choices, everything else under
// "Advanced". Every control saves immediately; there is no Save button to forget.

const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: 'salon', label: 'Hair salon' },
  { value: 'barber', label: 'Barber' },
  { value: 'beauty', label: 'Beauty / nails / cosmetics' },
  { value: 'wellness', label: 'Massage / wellness / spa' },
  { value: 'fitness', label: 'Fitness / personal training' },
  { value: 'clinic', label: 'Clinic / therapy' },
  { value: 'other', label: 'Something else' },
];

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
      setError(err instanceof Error ? err.message : 'Could not load this page. Please refresh.');
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
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24 text-stone-500">Loading…</div>;
  }

  const isOn = settings.agent_enabled;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <header>
        <div className="flex items-center gap-2.5">
          <Bot className="h-7 w-7 text-[#1A1714]" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight text-[#1A1714]">AI booking</h1>
        </div>
        <p className="mt-2 text-lg text-stone-600">
          Let people book you by asking ChatGPT, Siri or other AI assistants.
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
              Let AI assistants book appointments
            </h2>
            <p className="mt-1 text-base text-stone-600">
              {isOn ? 'On — assistants can see your free times and book them.' : 'Off — assistants cannot book you yet.'}
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
            <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…</span>
          ) : savedAt ? 'Saved' : ''}
        </p>
      </section>

      <section className={`${ADMIN_SURFACE} p-6`} aria-labelledby="ai-policy-heading">
        <h2 id="ai-policy-heading" className="text-xl font-semibold text-[#1A1714]">
          When an assistant books
        </h2>
        <div role="radiogroup" aria-labelledby="ai-policy-heading" className="mt-4 grid gap-3">
          <PolicyCard
            isSelected={settings.agent_consent_policy === 'auto'}
            title="Accept automatically"
            body="The booking goes straight into your calendar, like a normal online booking. You get an email."
            icon={CheckCircle2}
            onSelect={() => save({ agent_consent_policy: 'auto' })}
          />
          <PolicyCard
            isSelected={settings.agent_consent_policy === 'manual'}
            title="Approve each booking myself"
            body="You get an email with one button to approve or decline."
            icon={Hand}
            onSelect={() => save({ agent_consent_policy: 'manual' })}
          />
        </div>
      </section>

      <section className={`${ADMIN_SURFACE} p-6`} aria-labelledby="ai-find-heading">
        <h2 id="ai-find-heading" className="text-xl font-semibold text-[#1A1714]">
          So assistants can find you
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-base font-medium text-stone-700">What kind of business?</span>
            <select
              className={ADMIN_SELECT}
              value={settings.vertical ?? ''}
              onChange={(e) => save({ vertical: e.target.value || null })}
            >
              <option value="">Choose…</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-base font-medium text-stone-700">City</span>
            <input
              className={ADMIN_INPUT}
              placeholder="Hamburg"
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
          Bookings from assistants
        </h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {bookings.length === 0 && (
            <li className="py-6 text-center text-base text-stone-400">None yet.</li>
          )}
          {bookings.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-base font-medium text-[#1A1714]">{b.bookings?.customer_name ?? 'Customer'}</div>
                <div className="text-sm text-stone-500">
                  {b.bookings?.booking_date} · {b.bookings?.start_time?.slice(0, 5)} · via {b.agent_name ?? 'assistant'}
                </div>
              </div>
              <span className={`${ADMIN_STATUS_PILL} ${STATUS_STYLE[b.bookings?.status ?? ''] ?? 'bg-stone-100 text-stone-500'}`}>
                {b.bookings?.status ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <details className={`${ADMIN_SURFACE} group p-6`}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-stone-600">
          Advanced
          <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-5 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-stone-700">Earliest booking (minutes from now)</span>
              <input
                type="number"
                min={0}
                className={ADMIN_INPUT}
                defaultValue={settings.agent_lead_time_minutes}
                onBlur={(e) => save({ agent_lead_time_minutes: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-stone-700">Hold a time while customer decides (seconds)</span>
              <input
                type="number"
                min={60}
                className={ADMIN_INPUT}
                defaultValue={settings.agent_slot_hold_seconds}
                onBlur={(e) => save({ agent_slot_hold_seconds: Math.max(60, Number(e.target.value) || 600) })}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-stone-700">Short description for assistants</span>
              <textarea
                className={`${ADMIN_INPUT} min-h-[80px] resize-y`}
                placeholder="e.g. Friendly neighbourhood salon in Eimsbüttel, specialising in colour."
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
            <h3 className="text-sm font-semibold text-[#1A1714]">Activity</h3>
            <ul className="mt-2 divide-y divide-stone-100">
              {events.length === 0 && <li className="py-3 text-sm text-stone-400">No activity yet.</li>}
              {events.slice(0, 20).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[#1A1714]">
                    {ev.action}
                    {ev.result && <span className="text-stone-400"> → {ev.result}</span>}
                  </span>
                  <span className="text-xs text-stone-400">{new Date(ev.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}
