import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { ADMIN_INPUT, ADMIN_PRIMARY_BUTTON, ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../adminUi';
import AiRepliesCard from '../billing/AiRepliesCard';
import { euro, openBillingPortal, PRICE_CENTS, startUpgrade, SUPPORT_EMAIL, type PaidPlan, type PlanKey } from '../billing/billingApi';
import { BILLING_TEXT, type BillingText } from '../billing/billingText';
import { useBilling } from '../billing/useBilling';
import { confirmPendingPlan } from '../../../lib/ownerTracking';
import { fillText } from '../../../lib/bookingLanguage';

type Notice = { kind: 'success' | 'info' | 'error'; text: string } | null;

/** Read ?upgrade= / ?credits= once after returning from Stripe, then clean the address. */
function readReturnNotice(t: BillingText): Notice {
  const url = new URL(window.location.href);
  const upgrade = url.searchParams.get('upgrade');
  if (!upgrade) return null;
  url.searchParams.delete('upgrade');
  window.history.replaceState(window.history.state, '', url);
  if (upgrade !== 'success') return { kind: 'info', text: t.upgradeCancelled };
  return { kind: 'success', text: confirmPendingPlan() === 'StartTrial' ? t.trialStarted : t.upgradeSuccess };
}

const PLANS: { key: PlanKey; features: (keyof BillingText)[] }[] = [
  { key: 'free', features: ['fFreeBooking', 'fFreeTherapist', 'fFreeServices', 'fFreeBadge'] },
  { key: 'pro', features: ['fAllTherapists', 'fAi', 'fAiReplies', 'fDomain', 'fNoBadge', 'fSupport'] },
  { key: 'social', features: ['fSocialAll', 'fSocialDm', 'fSocialComments', 'fSocialAccounts'] },
  { key: 'custom', features: ['fCustomAll', 'fCustomLocations', 'fCustomReplies', 'fCustomSetup'] },
];

const isPaidPlan = (key: PlanKey): key is PaidPlan => key === 'pro' || key === 'social';
/** Which plans can be chosen from the current one (Social is an upgrade from Zenno). */
const canChoose = (current: PlanKey, key: PaidPlan) => (key === 'pro' ? current === 'free' : current === 'free' || current === 'pro');
/** Settings > Subscription: Free, Zenno (49 €), Zenno Social (69 €) and Custom, plus AI replies. */
export default function SubscriptionManagement() {
  const { t, locale } = useAdminText(BILLING_TEXT);
  const { businessId } = useTenant();
  const { overview, reload } = useBilling();
  const [notice, setNotice] = useState<Notice>(null);
  const [coupon, setCoupon] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const returned = readReturnNotice(t);
    if (!returned) return;
    setNotice(returned);
    // The webhook may take a moment after Stripe sends the owner back.
    const timer = window.setTimeout(reload, 4000);
    return () => window.clearTimeout(timer);
  }, [t, reload]);

  const go = async (action: () => Promise<string | null>, switchedText = t.upgradeSuccess) => {
    setIsBusy(true);
    setNotice(null);
    try {
      const url = await action();
      if (url) {
        window.location.href = url;
        return;
      }
      // The plan was switched on the existing subscription: no checkout needed.
      setNotice({ kind: 'success', text: switchedText });
      setIsBusy(false);
      reload();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : t.failed });
      setIsBusy(false);
    }
  };

  if (!overview) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-stone-400" /></div>;
  }

  const planName: Record<PlanKey, string> = { free: t.freePlan, pro: t.zennoPlan, social: t.socialPlan, custom: t.customPlan };
  const planLine: Record<PlanKey, string> = { free: t.freeLine, pro: t.zennoLine, social: t.socialLine, custom: t.customLine };
  const noticeStyle = { success: 'bg-emerald-50 text-emerald-900', info: 'bg-stone-100 text-stone-700', error: 'bg-red-50 text-red-700' };

  return (
    <div className="space-y-5">
      <header>
        <h3 className="text-lg font-semibold text-[#1A1714]">{t.title}</h3>
        <p className="text-sm text-stone-500">{t.subtitle}</p>
      </header>

      {notice && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${noticeStyle[notice.kind]}`}>{notice.text}</p>}
      {overview.subscription_status === 'past_due' && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.paymentIssue}</p>}
      {overview.trial_end && (
        <p role="status" className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-700">
          {fillText(t.trialUntil, { date: new Date(overview.trial_end).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map(({ key, features }) => {
          const isCurrent = overview.plan === key;
          return (
            <section key={key} className={`${ADMIN_SURFACE} flex flex-col gap-4 p-5 ${isCurrent ? 'ring-2 ring-[#1A1714]' : ''}`}>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-lg font-semibold text-[#1A1714]">{planName[key]}</h4>
                  {isCurrent && <span className="rounded-full bg-[#1A1714] px-2.5 py-0.5 text-xs font-medium text-white">{t.current}</span>}
                </div>
                <p className="text-sm text-stone-500">{planLine[key]}</p>
              </div>
              {isPaidPlan(key) && (
                <p className="text-3xl font-semibold tracking-tight text-[#1A1714]">
                  {euro(PRICE_CENTS[key], locale)}<span className="ml-1 text-sm font-normal text-stone-500">{t.perMonth} · {t.vatIncluded}</span>
                </p>
              )}
              {key === 'free' && <p className="text-3xl font-semibold tracking-tight text-[#1A1714]">{euro(0, locale)}</p>}
              <ul className="flex-1 space-y-2">
                {features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-stone-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{t[feature]}</li>
                ))}
              </ul>
              {isPaidPlan(key) && canChoose(overview.plan, key) && (
                <div className="space-y-2">
                  {overview.plan === 'free' && (
                    <label className="block text-xs text-stone-500">{t.coupon}
                      <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder={t.couponPlaceholder} maxLength={100} className={`${ADMIN_INPUT} mt-1 py-2`} />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => go(() => startUpgrade(coupon.trim(), key), key === 'social' ? t.switchedSocial : t.switchedZenno)}
                    className={`${key === 'social' ? ADMIN_PRIMARY_BUTTON : ADMIN_SECONDARY_BUTTON} w-full`}
                  >
                    {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}{isBusy ? t.starting : overview.plan === 'free' && overview.trial_available ? t.chooseTrial : key === 'social' ? t.chooseSocial : t.choose}
                  </button>
                </div>
              )}
              {isPaidPlan(key) && isCurrent && overview.has_subscription && businessId && (
                <button type="button" disabled={isBusy} onClick={() => go(() => openBillingPortal(businessId))} className={`${ADMIN_SECONDARY_BUTTON} w-full`}>{t.manage}</button>
              )}
              {key === 'custom' && !isCurrent && (
                <div className="space-y-1">
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Zenno custom plan')}`} className={`${ADMIN_SECONDARY_BUTTON} w-full`}>{t.contact}</a>
                  <p className="select-all text-center text-xs text-stone-400">{SUPPORT_EMAIL}</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <AiRepliesCard overview={overview} />
    </div>
  );
}
