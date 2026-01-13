import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, AlertCircle, CreditCard, Banknote, Link as LinkIcon, CheckCircle, XCircle, RefreshCw, Wallet } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';

interface BusinessConnectData {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean;
  stripe_connect_charges_enabled: boolean;
  stripe_connect_payouts_enabled: boolean;
  stripe_connect_country: string | null;
  platform_fee_percentage: number;
}

export default function PaymentSettings() {
  const { businessId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [allowPayInPerson, setAllowPayInPerson] = useState(false);
  const [connectData, setConnectData] = useState<BusinessConnectData | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [connectingToStripe, setConnectingToStripe] = useState(false);
  
  // PayPal settings
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalSecret, setPaypalSecret] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchConnectData();
    handleConnectReturn();
  }, [businessId]);

  const handleConnectReturn = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isReturn = urlParams.get('connect_return');
    const isRefresh = urlParams.get('connect_refresh');

    if ((isReturn || isRefresh) && businessId) {
      await handleVerifyConnection();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const fetchSettings = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .eq('business_id', businessId)
      .in('key', ['stripe_enabled', 'stripe_secret_key', 'allow_pay_in_person']);

    if (data) {
      data.forEach((setting) => {
        const value = setting.value;
        if (setting.key === 'stripe_enabled') {
          setStripeEnabled(value === 'true' || value === true);
        } else if (setting.key === 'stripe_secret_key') {
          setStripeSecretKey(value);
        } else if (setting.key === 'allow_pay_in_person') {
          setAllowPayInPerson(value === 'true' || value === true);
        }
      });
    }
    setLoading(false);
  };

  const fetchConnectData = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('businesses')
      .select('stripe_connect_account_id, stripe_connect_onboarding_complete, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_country, platform_fee_percentage')
      .eq('id', businessId)
      .maybeSingle();

    if (!error && data) {
      setConnectData(data);
      if (data.stripe_connect_country) {
        setSelectedCountry(data.stripe_connect_country);
      }
    }
  };

  const handleConnectToStripe = async () => {
    if (!businessId) return;

    setConnectingToStripe(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-connect-account-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            businessId,
            country: selectedCountry,
            accountType: 'standard',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create Connect account link');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error connecting to Stripe:', error);
      alert('Failed to connect to Stripe. Please try again.');
    } finally {
      setConnectingToStripe(false);
    }
  };

  const handleVerifyConnection = async () => {
    if (!businessId) return;

    setConnectingToStripe(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-connect-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ businessId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to verify connection');
      }

      await fetchConnectData();
      setSavedMessage('Connection verified successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error verifying connection:', error);
      alert('Failed to verify connection. Please try again.');
    } finally {
      setConnectingToStripe(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    setSavedMessage('');

    try {
      // Update all settings
      const updates = [
        {
          business_id: businessId,
          key: 'stripe_enabled',
          value: JSON.stringify(stripeEnabled),
          category: 'payment',
        },
        {
          business_id: businessId,
          key: 'stripe_secret_key',
          value: stripeSecretKey,
          category: 'payment',
        },
        {
          business_id: businessId,
          key: 'allow_pay_in_person',
          value: JSON.stringify(allowPayInPerson),
          category: 'payment',
        },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert(update, {
            onConflict: 'business_id,key',
          });

        if (error) throw error;
      }

      setSavedMessage('Payment settings saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-stone-600">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stripe Connect */}
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <LinkIcon className="w-5 h-5" />
          <span>Stripe Connect</span>
        </h3>

        <div className="space-y-4">
          {connectData?.stripe_connect_onboarding_complete ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-800">Connected to Stripe</p>
              </div>
              <div className="space-y-2 text-sm text-green-700">
                <p>Account ID: {connectData.stripe_connect_account_id?.substring(0, 20)}...</p>
                <p>Country: {connectData.stripe_connect_country}</p>
                <p>Platform Fee: {connectData.platform_fee_percentage}%</p>
                <div className="flex items-center space-x-4 mt-3">
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Charges Enabled</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Payouts Enabled</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleVerifyConnection}
                disabled={connectingToStripe}
                className="mt-3 flex items-center space-x-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${connectingToStripe ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>
          ) : connectData?.stripe_connect_account_id ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <div className="flex items-center space-x-2 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <p className="font-medium text-yellow-800">Onboarding Incomplete</p>
              </div>
              <p className="text-sm text-yellow-700 mb-3">
                Your Stripe Connect account has been created but onboarding is not complete. Click below to continue.
              </p>
              <button
                onClick={handleConnectToStripe}
                disabled={connectingToStripe}
                className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white hover:bg-yellow-700 transition-colors disabled:opacity-50 text-sm"
              >
                <LinkIcon className="w-4 h-4" />
                <span>{connectingToStripe ? 'Connecting...' : 'Complete Onboarding'}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-stone-50 border border-stone-200 rounded">
              <p className="text-sm text-stone-700 mb-4">
                Connect your Stripe account to receive payments directly to your bank account.
                We charge a {connectData?.platform_fee_percentage || 2.5}% platform fee on each transaction.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Select Your Country
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
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
                <p className="text-xs text-stone-500 mt-1">
                  Select the country where your business is registered
                </p>
              </div>
              <button
                onClick={handleConnectToStripe}
                disabled={connectingToStripe}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <LinkIcon className="w-5 h-5" />
                <span>{connectingToStripe ? 'Connecting...' : 'Connect with Stripe'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stripe Settings */}
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <CreditCard className="w-5 h-5" />
          <span>Stripe Payment Processing (Legacy)</span>
        </h3>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This is the legacy payment method. We recommend using Stripe Connect above for better payment routing and automatic payouts.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-stone-50 rounded">
            <div>
              <p className="font-medium text-stone-800">Enable Stripe Payments</p>
              <p className="text-sm text-stone-600">Accept online payments via credit/debit card</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={stripeEnabled}
                onChange={(e) => setStripeEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {stripeEnabled && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Stripe Live Secret Key
              </label>
              <input
                type="password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
                placeholder="sk_live_..."
              />
              <p className="text-xs text-stone-500 mt-1">
                Get your live secret key from{' '}
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  Stripe Dashboard
                </a>
                {' '}(use live keys for production, not test keys)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pay in Person */}
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <Banknote className="w-5 h-5" />
          <span>Pay in Person</span>
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded">
            <div>
              <p className="font-medium text-stone-800">Allow Pay in Person</p>
              <p className="text-sm text-stone-600">
                Let customers choose to pay when they arrive at your location
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={allowPayInPerson}
                onChange={(e) => setAllowPayInPerson(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {allowPayInPerson && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                When enabled, customers will see two payment options:
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                <li>Pay Online (via Stripe)</li>
                <li>Pay in Person (at your location)</li>
              </ul>
              <p className="text-xs text-blue-600 mt-2">
                You can mark "Pay in Person" bookings as paid in the POS system
              </p>
            </div>
          )}
        </div>
      </div>

      {savedMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{savedMessage}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{saving ? 'Saving...' : 'Save Payment Settings'}</span>
        </button>
      </div>
    </div>
  );
}
