import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// One-tap approval page linked from the merchant's "new AI booking" email.
// Built for busy, non-technical owners: one booking, two big buttons.

type Action = 'preview' | 'approve' | 'decline';
type Lang = 'en' | 'de';

interface BookingSummary {
  status: string;
  date: string;
  startTime: string;
  customerName: string | null;
  service: string | null;
  specialist: string | null;
  business: string | null;
}

interface ApproveResponse {
  booking?: BookingSummary;
  changed?: boolean;
  error?: string;
}

const TEXT = {
  en: {
    loading: 'Loading booking…',
    invalid: 'This approval link is not valid.',
    failed: 'Something went wrong. Please try again.',
    title: 'New booking from an AI assistant',
    approve: 'Approve booking',
    decline: 'Decline',
    approved: 'Booking approved. It is now in your calendar.',
    declined: 'Booking declined.',
    alreadyDone: 'This booking was already handled.',
    with: 'with',
  },
  de: {
    loading: 'Buchung wird geladen…',
    invalid: 'Dieser Bestätigungslink ist ungültig.',
    failed: 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    title: 'Neue Buchung über einen KI-Assistenten',
    approve: 'Buchung bestätigen',
    decline: 'Ablehnen',
    approved: 'Buchung bestätigt. Sie steht jetzt in Ihrem Kalender.',
    declined: 'Buchung abgelehnt.',
    alreadyDone: 'Diese Buchung wurde bereits bearbeitet.',
    with: 'bei',
  },
} as const;

const detectLang = (): Lang => (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en');

async function callApprove(token: string, action: Action): Promise<ApproveResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('agent-approve', { body: { token, action } });
    if (!error) return data as ApproveResponse;
    // HTTP errors carry the Response; network failures carry the thrown error.
    const context = (error as { context?: unknown }).context;
    const payload = context instanceof Response ? await context.json().catch(() => null) : null;
    return { error: payload?.error };
  } catch (err) {
    console.error('agent-approve call failed', err);
    return {};
  }
}

export default function ApproveBooking() {
  const t = TEXT[detectLang()];
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState<Action | null>('preview');

  useEffect(() => {
    if (!token) {
      setIsError(true);
      setMessage(t.invalid);
      setBusy(null);
      return;
    }
    callApprove(token, 'preview').then((res) => {
      setBusy(null);
      if (!res.booking) {
        setIsError(true);
        setMessage(res.error ?? t.failed);
        return;
      }
      setBooking(res.booking);
      if (res.booking.status !== 'pending') setMessage(t.alreadyDone);
    });
  }, [token, t]);

  const act = async (action: Exclude<Action, 'preview'>) => {
    setBusy(action);
    const res = await callApprove(token, action);
    setBusy(null);
    if (!res.booking) {
      setIsError(true);
      setMessage(res.error ?? t.failed);
      return;
    }
    setBooking(res.booking);
    setIsError(false);
    if (!res.changed) setMessage(t.alreadyDone);
    else setMessage(action === 'approve' ? t.approved : t.declined);
  };

  const isPending = booking?.status === 'pending' && !message;

  return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center px-4 py-10">
      <section
        aria-labelledby="approve-heading"
        className="w-full max-w-md rounded-3xl bg-white shadow-[0_24px_60px_-20px_rgba(28,25,23,0.35)] p-8"
      >
        {busy === 'preview' && (
          <p className="flex items-center gap-3 text-lg text-stone-600">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> {t.loading}
          </p>
        )}

        {booking && (
          <>
            <p className="text-sm uppercase tracking-[0.18em] text-stone-500">{booking.business}</p>
            <h1 id="approve-heading" className="mt-2 text-2xl font-semibold text-stone-900">
              {t.title}
            </h1>
            <dl className="mt-6 space-y-2 text-lg text-stone-800">
              <dt className="sr-only">Service</dt>
              <dd className="text-2xl font-medium">{booking.service}</dd>
              <dt className="sr-only">Time</dt>
              <dd>
                {booking.date} · {booking.startTime}
                {booking.specialist ? ` · ${t.with} ${booking.specialist}` : ''}
              </dd>
              <dt className="sr-only">Customer</dt>
              <dd className="text-stone-600">{booking.customerName}</dd>
            </dl>
          </>
        )}

        {isPending && (
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => act('approve')}
              disabled={busy !== null}
              className="w-full rounded-2xl bg-stone-900 py-5 text-xl font-semibold text-white transition-transform active:scale-[0.98] hover:bg-stone-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-60"
            >
              {busy === 'approve' ? <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden /> : t.approve}
            </button>
            <button
              type="button"
              onClick={() => act('decline')}
              disabled={busy !== null}
              className="w-full rounded-2xl border-2 border-stone-300 py-4 text-lg font-medium text-stone-700 transition-colors hover:border-stone-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-stone-400 disabled:opacity-60"
            >
              {busy === 'decline' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden /> : t.decline}
            </button>
          </div>
        )}

        {message && (
          <p
            role="status"
            className={`mt-8 flex items-start gap-3 text-lg ${isError ? 'text-red-700' : 'text-emerald-700'}`}
          >
            {isError ? (
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            ) : booking?.status === 'cancelled' ? (
              <XCircle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            ) : (
              <CheckCircle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            )}
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
