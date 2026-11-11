import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText } from '../../../lib/bookingLanguage';
import { confirmPendingPlan } from '../../../lib/ownerTracking';
import { BRAND_LOGO_LIGHT } from '../../../lib/brand';
import { euro, loadBillingOverview, PLAN_PRICE_CENTS, startUpgrade, type BillingOverview } from './billingApi';
import { BILLING_TEXT } from './billingText';

const ACTIVATION_POLL_MS = 2000;
const ACTIVATION_MAX_POLLS = 20;

/** Reads ?upgrade= once after Stripe sends the owner back, then cleans the address. */
function takeCheckoutReturn(): 'success' | 'cancelled' | null {
  const url = new URL(window.location.href);
  const upgrade = url.searchParams.get('upgrade');
  if (!upgrade) return null;
  url.searchParams.delete('upgrade');
  window.history.replaceState(window.history.state, '', url);
  return upgrade === 'success' ? 'success' : 'cancelled';
}

interface StartTrialScreenProps {
  overview: BillingOverview;
  onLogout: () => void;
}

/**
 * Shown instead of the dashboard to a new shop that has not started a plan:
 * the 7-day free trial of the Zenno plan (card at Stripe, charged after the
 * trial). A shop whose trial already ran out sees the same screen without the
 * trial wording.
 */
export default function StartTrialScreen({ overview, onLogout }: StartTrialScreenProps) {
  const { t, locale } = useAdminText(BILLING_TEXT);
  const [isActivating, setIsActivating] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  // Back from Stripe: wait for the webhook to mark the shop as trialing, then open the dashboard.
  useEffect(() => {
    if (takeCheckoutReturn() !== 'success') return;
    confirmPendingPlan();
    setIsActivating(true);
    let polls = 0;
    const timer = window.setInterval(async () => {
      polls += 1;
      try {
        const latest = await loadBillingOverview();
        if (!latest.needs_plan) {
          window.clearInterval(timer);
          window.location.replace('/admin');
          return;
        }
      } catch (err) {
        console.error('Could not check the trial:', err);
      }
      if (polls >= ACTIVATION_MAX_POLLS) {
        window.clearInterval(timer);
        setIsActivating(false);
        setError(t.failed);
      }
    }, ACTIVATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [t.failed]);

  const start = async () => {
    setIsBusy(true);
    setError('');
    try {
      const url = await startUpgrade('', 'pro');
      if (url) {
        window.location.href = url;
        return;
      }
      window.location.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
      setIsBusy(false);
    }
  };

  const isTrial = overview.trial_available;
  const price = euro(PLAN_PRICE_CENTS, locale);
  const points = [t.trialPoint1, t.trialPoint2, ...(isTrial ? [t.trialPoint3] : [])];

  return (
    <main className="relative flex min-h-screen flex-col bg-[#1A1714] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_60%)]" />
      <header className="relative flex items-center justify-between px-4 py-5 sm:px-8">
        <img src={BRAND_LOGO_LIGHT} alt="Zenno" width={96} height={24} className="h-6 w-auto" />
        <button type="button" onClick={onLogout} className="rounded-full px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60">
          {t.logOut}
        </button>
      </header>

      <section aria-labelledby="trial-heading" className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16 sm:px-0">
        {isActivating ? (
          <div role="status" className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            <p className="text-lg text-white">{t.trialActivating}</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/50">{isTrial ? `${price} ${t.perMonth}` : t.zennoPlan}</p>
            <h1 id="trial-heading" className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
              {isTrial ? t.trialTitle : t.subscribeTitle}
            </h1>
            <p className="mt-4 text-base text-white/70">{isTrial ? t.trialLead : t.subscribeLead}</p>

            <ul className="mt-8 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex gap-3 text-sm text-white/85">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10"><Check className="h-3 w-3" /></span>
                  {point}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={start}
              disabled={isBusy}
              className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-base font-semibold text-[#1A1714] shadow-[0_10px_40px_-10px_rgba(255,255,255,0.35)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isBusy ? t.starting : isTrial ? t.trialCta : t.subscribeCta}
            </button>
            <p className="mt-3 text-center text-xs text-white/50">
              {isTrial ? fillText(t.trialFinePrint, { price }) : `${price} ${t.perMonth} · ${t.vatIncluded}`}
            </p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-100">{error}</p>}
          </>
        )}
      </section>
    </main>
  );
}
