import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Link2,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../lib/tenantContext';
import { adminAuth } from '../../../lib/adminAuth';
import {
  ADMIN_ICON_TILE,
  ADMIN_INPUT,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_SELECT,
  ADMIN_STATUS_PILL,
} from '../adminUi';

interface BusinessConnectData {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean;
  stripe_connect_charges_enabled: boolean;
  stripe_connect_payouts_enabled: boolean;
  stripe_connect_country: string | null;
  platform_fee_percentage: number;
}

interface Notice {
  tone: 'success' | 'error';
  text: string;
}

const PAYMENT_SETTING_KEYS = [
  'stripe_enabled',
  'allow_pay_in_person',
  'paypal_enabled',
  'paypal_client_id',
  'paypal_secret',
];

function readSettingValue(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className={`relative inline-flex shrink-0 items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <span className="sr-only">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-focus-visible:ring-4 peer-focus-visible:ring-stone-900/10 peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
    </label>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CreditCard;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={ADMIN_ICON_TILE}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-[#1A1714]">{title}</h3>
        <p className="mt-0.5 max-w-2xl text-sm leading-6 text-stone-500">{description}</p>
      </div>
    </div>
  );
}

export default function PaymentSettings() {
  const { businessId } = useTenant();
  const currentUser = adminAuth.getCurrentUser();
  const isOwner = currentUser?.role === 'owner';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [allowPayInPerson, setAllowPayInPerson] = useState(false);
  const [connectData, setConnectData] = useState<BusinessConnectData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [connectingToStripe, setConnectingToStripe] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalSecret, setPaypalSecret] = useState('');

  const fetchSettings = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .eq('business_id', businessId)
      .in('key', PAYMENT_SETTING_KEYS);

    if (error) throw error;

    data?.forEach((setting) => {
      const value = readSettingValue(setting.value);
      if (setting.key === 'stripe_enabled') setStripeEnabled(value === true || value === 'true');
      if (setting.key === 'allow_pay_in_person') setAllowPayInPerson(value === true || value === 'true');
      if (setting.key === 'paypal_enabled') setPaypalEnabled(value === true || value === 'true');
      if (setting.key === 'paypal_client_id') setPaypalClientId(typeof value === 'string' ? value : '');
      if (setting.key === 'paypal_secret') setPaypalSecret(typeof value === 'string' ? value : '');
    });
  };

  const fetchConnectData = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('businesses')
      .select('stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_country, platform_fee_percentage')
      .eq('id', businessId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return;

    setConnectData(data);
    if (data.stripe_connect_country) setSelectedCountry(data.stripe_connect_country);
  };

  const refreshPaymentData = async () => {
    await Promise.all([fetchSettings(), fetchConnectData()]);
  };

  const handleVerifyConnection = async () => {
    if (!businessId || !isOwner) return;

    setConnectingToStripe(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('verify-connect-account', {
        body: {},
      });

      if (error) throw error;
      await refreshPaymentData();
      if (data?.onboardingComplete) setStripeEnabled(true);
      setNotice({ tone: 'success', text: 'Stripe connection verified.' });
    } catch (error) {
      console.error('Error verifying Stripe connection:', error);
      setNotice({ tone: 'error', text: 'We could not verify the Stripe connection. Try again.' });
    } finally {
      setConnectingToStripe(false);
    }
  };

  useEffect(() => {
    if (!businessId || !isOwner) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        await refreshPaymentData();

        const params = new URLSearchParams(window.location.search);
        if (params.has('connect_return') || params.has('connect_refresh')) {
          await handleVerifyConnection();
          window.history.replaceState({}, document.title, '/admin?view=settings&tab=payment');
        }
      } catch (error) {
        console.error('Error loading payment settings:', error);
        setNotice({ tone: 'error', text: 'Payment settings could not be loaded.' });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [businessId, isOwner]);

  const handleConnectToStripe = async () => {
    if (!businessId || !isOwner) return;

    setConnectingToStripe(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account-link', {
        body: { country: selectedCountry, accountType: 'standard' },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Stripe did not return an onboarding link');
      window.location.assign(data.url);
    } catch (error) {
      console.error('Error connecting to Stripe:', error);
      setNotice({ tone: 'error', text: 'Stripe onboarding could not be started. Try again.' });
      setConnectingToStripe(false);
    }
  };

  const handleSave = async () => {
    if (!businessId || !isOwner) return;

    setSaving(true);
    setNotice(null);
    try {
      const updates = [
        { key: 'stripe_enabled', value: JSON.stringify(stripeEnabled) },
        { key: 'allow_pay_in_person', value: JSON.stringify(allowPayInPerson) },
        { key: 'paypal_enabled', value: JSON.stringify(paypalEnabled) },
        { key: 'paypal_client_id', value: paypalClientId.trim() },
        { key: 'paypal_secret', value: paypalSecret.trim() },
      ].map((setting) => ({
        ...setting,
        business_id: businessId,
        category: 'payment',
      }));

      const { error } = await supabase
        .from('site_settings')
        .upsert(updates, { onConflict: 'business_id,key' });

      if (error) throw error;
      setNotice({ tone: 'success', text: 'Payment settings saved.' });
    } catch (error) {
      console.error('Error saving payment settings:', error);
      setNotice({ tone: 'error', text: 'Payment settings could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center text-center">
        <div className={`${ADMIN_ICON_TILE} mb-4`}>
          <LockKeyhole className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h3 className="text-base font-semibold text-[#1A1714]">Owner access required</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
          Payment connections affect payouts and customer charges, so only the business owner can change them.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-16 rounded-2xl bg-stone-900/[0.04]" />
        <div className="h-56 rounded-2xl bg-stone-900/[0.04]" />
        <div className="h-36 rounded-2xl bg-stone-900/[0.04]" />
      </div>
    );
  }

  const stripeConnected = Boolean(connectData?.stripe_connect_onboarding_complete);
  const accountLabel = connectData?.stripe_connect_account_id
    ? `${connectData.stripe_connect_account_id.slice(0, 8)}…${connectData.stripe_connect_account_id.slice(-4)}`
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[#1A1714]">Payments</h2>
            <span className={`${ADMIN_STATUS_PILL} bg-stone-900/[0.06] text-stone-600`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Owner only
            </span>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-stone-500">
            Connect payouts, choose checkout methods, and control how card guarantees work.
          </p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'
              : 'border-red-200/80 bg-red-50/70 text-red-800'
          }`}
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {notice.text}
        </div>
      )}

      <section className="space-y-5 border-b border-stone-200/70 pb-8">
        <SectionHeading
          icon={Link2}
          title="Stripe payouts"
          description="The owner completes Stripe's hosted verification. Zenno never asks your team to paste a Stripe secret key."
        />

        {stripeConnected ? (
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-5">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <p className="font-semibold text-emerald-950">Stripe is connected</p>
                </div>
                <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-emerald-800/60">Account</dt>
                    <dd className="mt-0.5 font-medium text-emerald-950 tabular-nums">{accountLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/60">Country</dt>
                    <dd className="mt-0.5 font-medium text-emerald-950">{connectData?.stripe_connect_country || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-emerald-800/60">Zenno fee</dt>
                    <dd className="mt-0.5 font-medium text-emerald-950 tabular-nums">
                      {connectData?.platform_fee_percentage ?? 2.5}%
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`${ADMIN_STATUS_PILL} bg-white/[0.65] text-emerald-800`}>
                    <Check className="h-3.5 w-3.5" /> Charges enabled
                  </span>
                  <span className={`${ADMIN_STATUS_PILL} bg-white/[0.65] text-emerald-800`}>
                    <Check className="h-3.5 w-3.5" /> Payouts enabled
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleVerifyConnection}
                disabled={connectingToStripe}
                className={ADMIN_SECONDARY_BUTTON}
              >
                <RefreshCw className={`h-4 w-4 ${connectingToStripe ? 'animate-spin' : ''}`} />
                Refresh status
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-t border-emerald-200/70 pt-4">
              <div>
                <p className="text-sm font-medium text-emerald-950">Accept online card payments</p>
                <p className="mt-0.5 text-xs text-emerald-800/70">Pause checkout without disconnecting payouts.</p>
              </div>
              <Switch checked={stripeEnabled} onChange={setStripeEnabled} label="Accept online card payments" />
            </div>
          </div>
        ) : connectData?.stripe_connect_account_id ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="font-semibold text-amber-950">Stripe setup is not finished</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-800">
                  Continue the hosted onboarding to enable charges and payouts for this business.
                </p>
                <button
                  type="button"
                  onClick={handleConnectToStripe}
                  disabled={connectingToStripe}
                  className={`${ADMIN_PRIMARY_BUTTON} mt-4`}
                >
                  <ExternalLink className="h-4 w-4" />
                  {connectingToStripe ? 'Opening Stripe…' : 'Continue in Stripe'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 rounded-2xl bg-stone-900/[0.035] p-5 md:grid-cols-[1fr_220px] md:items-end">
            <div>
              <p className="text-sm font-medium text-[#1A1714]">Connect the business owner's Stripe account</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
                Stripe handles identity checks and bank details. Zenno receives only the connected account ID needed to route payments and no-show fees.
              </p>
              <button
                type="button"
                onClick={handleConnectToStripe}
                disabled={connectingToStripe}
                className={`${ADMIN_PRIMARY_BUTTON} mt-4`}
              >
                <Link2 className="h-4 w-4" />
                {connectingToStripe ? 'Opening Stripe…' : 'Connect Stripe'}
              </button>
            </div>
            <div>
              <label htmlFor="stripe-country" className="mb-2 block text-xs font-medium text-stone-500">
                Registered country
              </label>
              <select
                id="stripe-country"
                value={selectedCountry}
                onChange={(event) => setSelectedCountry(event.target.value)}
                className={ADMIN_SELECT}
              >
                <option value="DE">Germany</option>
                <option value="AT">Austria</option>
                <option value="BE">Belgium</option>
                <option value="FR">France</option>
                <option value="NL">Netherlands</option>
                <option value="ES">Spain</option>
                <option value="IT">Italy</option>
                <option value="US">United States</option>
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-5 border-b border-stone-200/70 pb-8">
        <SectionHeading
          icon={Banknote}
          title="Pay at venue"
          description="Offer in-person payment while still protecting eligible appointments with a card guarantee."
        />
        <div className="flex items-center justify-between gap-5 rounded-2xl bg-stone-900/[0.035] p-5">
          <div>
            <p className="text-sm font-medium text-[#1A1714]">Show “Pay at venue” at checkout</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">
              If a service has a no-show fee, Zenno can save a card guarantee without charging the appointment amount.
            </p>
          </div>
          <Switch checked={allowPayInPerson} onChange={setAllowPayInPerson} label="Allow pay at venue" />
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          icon={WalletCards}
          title="PayPal"
          description="Optional checkout method. Credentials can only be viewed and changed by the business owner."
        />
        <div className="flex items-center justify-between gap-5 rounded-2xl bg-stone-900/[0.035] p-5">
          <div>
            <p className="text-sm font-medium text-[#1A1714]">Accept PayPal</p>
            <p className="mt-1 text-sm text-stone-500">Customers can pay from their PayPal account at checkout.</p>
          </div>
          <Switch checked={paypalEnabled} onChange={setPaypalEnabled} label="Accept PayPal" />
        </div>

        {paypalEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="paypal-client-id" className="mb-2 block text-sm font-medium text-stone-700">
                PayPal client ID
              </label>
              <input
                id="paypal-client-id"
                type="text"
                value={paypalClientId}
                onChange={(event) => setPaypalClientId(event.target.value)}
                className={ADMIN_INPUT}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="paypal-secret" className="mb-2 block text-sm font-medium text-stone-700">
                PayPal secret
              </label>
              <input
                id="paypal-secret"
                type="password"
                value={paypalSecret}
                onChange={(event) => setPaypalSecret(event.target.value)}
                className={ADMIN_INPUT}
                autoComplete="new-password"
              />
            </div>
            <a
              href="https://developer.paypal.com/dashboard/applications/live"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#1A1714] sm:col-span-2"
            >
              Open PayPal developer dashboard <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </section>

      <div className="flex justify-end border-t border-stone-200/70 pt-6">
        <button type="button" onClick={handleSave} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
