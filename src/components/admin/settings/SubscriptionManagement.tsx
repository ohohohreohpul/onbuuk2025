import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Crown, Calendar, CreditCard, Check, Loader, AlertCircle, Tag } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useCurrency } from '../../../lib/currencyContext';

interface Business {
  id: string;
  name: string;
  plan_type: string;
  subscription_status: string | null;
  trial_end_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface PlanDetails {
  name: string;
  priceCents: number;
  features: string[];
}

const PLAN_DETAILS: Record<string, PlanDetails> = {
  free: {
    name: 'Free',
    priceCents: 0,
    features: [
      '1 admin user (owner only)',
      'Up to 50 bookings per month',
      'Up to 3 services',
      '1 specialist',
      'Email notifications',
    ],
  },
  standard: {
    name: 'Standard',
    priceCents: 2900,
    features: [
      'Up to 3 admin users',
      'Unlimited bookings',
      'Up to 10 services',
      'Up to 3 specialists',
      'Gift cards enabled',
      'Basic loyalty program',
      'Custom logo',
      'Email notifications',
    ],
  },
  pro: {
    name: 'Pro',
    priceCents: 4500,
    features: [
      'Unlimited admin users',
      'Unlimited bookings',
      'Unlimited services',
      'Unlimited specialists',
      'Advanced gift cards',
      'Advanced loyalty program',
      'Full custom branding',
      'Remove "Powered by Buuk" badge',
      'Email notifications',
      'Priority support',
    ],
  },
};

export default function SubscriptionManagement() {
  const { businessId } = useTenant();
  const { formatAmount } = useCurrency();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'pro' | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    fetchBusiness();

    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'success') {
      setSuccessMessage('Successfully upgraded! Your subscription will be activated shortly.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('upgrade') === 'cancelled') {
      setSuccessMessage('Upgrade cancelled. You can try again anytime.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [businessId]);

  const fetchBusiness = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('businesses')
      .select('id, name, plan_type, subscription_status, trial_end_date, stripe_customer_id, stripe_subscription_id')
      .eq('id', businessId)
      .single();

    if (data) {
      setBusiness(data);
    }

    setLoading(false);
  };

  const handleUpgrade = async (planType: 'standard' | 'pro') => {
    if (processing || !businessId) return;

    setProcessing(true);
    setCouponError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please sign in again to continue');
        setProcessing(false);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-subscription`;

      const requestBody: {
        business_id: string;
        plan_type: string;
        coupon_code?: string;
      } = {
        business_id: businessId,
        plan_type: planType,
      };

      if (couponCode.trim()) {
        requestBody.coupon_code = couponCode.trim();
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stripe checkout error:', errorData);

        if (errorData.error && errorData.error.toLowerCase().includes('coupon')) {
          setCouponError('Invalid or expired coupon code. Please check and try again.');
          setProcessing(false);
          return;
        }

        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start upgrade process. Please try again or contact support.');
      setProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    if (processing || !business?.stripe_customer_id || !businessId) return;

    setProcessing(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          business_id: businessId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Portal session error:', errorData);
        throw new Error(errorData.error || 'Failed to create portal session');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No portal URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to open subscription management. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 text-stone-600 animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-stone-600">Business not found</p>
      </div>
    );
  }

  const currentPlan = business.plan_type.toLowerCase();
  const isFree = currentPlan === 'free' || currentPlan === 'starter';
  const isStandard = currentPlan === 'standard';
  const isPro = currentPlan === 'pro';
  const isTrialing = business.subscription_status === 'trialing';
  const trialEndDate = business.trial_end_date ? new Date(business.trial_end_date) : null;
  const daysUntilTrialEnd = trialEndDate
    ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-2">Subscription Management</h3>
        <p className="text-sm text-stone-600">Manage your plan and billing</p>
      </div>

      {successMessage && (
        <div className={`border p-4 ${
          successMessage.includes('cancelled')
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {isTrialing && daysUntilTrialEnd !== null && daysUntilTrialEnd > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 flex items-start space-x-3">
          <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900">Trial Active</h4>
            <p className="text-sm text-blue-800">
              Your free trial ends in {daysUntilTrialEnd} day{daysUntilTrialEnd !== 1 ? 's' : ''}
              {trialEndDate && ` (${trialEndDate.toLocaleDateString()})`}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 flex items-center justify-center ${
                isPro ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                isStandard ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                'bg-stone-200'
              }`}>
                <Crown className={`w-6 h-6 ${isPro || isStandard ? 'text-white' : 'text-stone-600'}`} />
              </div>
              <div>
                <h4 className="text-xl font-bold text-stone-900">
                  {PLAN_DETAILS[currentPlan]?.name || 'Current Plan'}
                </h4>
                <p className={`text-sm font-medium ${isTrialing ? 'text-blue-600' : 'text-stone-600'}`}>
                  {isTrialing
                    ? '🎉 Free Trial Active'
                    : business.subscription_status && business.subscription_status !== 'incomplete'
                      ? `Status: ${business.subscription_status.charAt(0).toUpperCase() + business.subscription_status.slice(1)}`
                      : 'Active'
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-stone-900">
                {formatAmount((PLAN_DETAILS[currentPlan]?.priceCents || 0) / 100)}
              </p>
              <p className="text-sm text-stone-600">{isFree ? 'Free forever' : 'starting at / month'}</p>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-6 mb-6">
            <h5 className="font-semibold text-stone-900 mb-3">Current Plan Includes:</h5>
            <div className="space-y-2">
              {PLAN_DETAILS[currentPlan]?.features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-stone-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {business.stripe_customer_id && !isFree && (
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={handleManageSubscription}
                disabled={processing}
                className="flex-1 bg-stone-100 text-stone-900 py-3 px-6 font-semibold hover:bg-stone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <CreditCard className="w-5 h-5" />
                <span>Manage Billing</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {(isFree || isStandard) && (
        <div className="space-y-4">
          <h4 className="font-bold text-stone-900 text-lg">
            {isFree ? 'Upgrade Your Plan' : 'Upgrade to Pro'}
          </h4>

          {isFree && (
            <div className="grid md:grid-cols-2 gap-4">
              <PlanCard
                planType="standard"
                selected={selectedPlan === 'standard'}
                onSelect={() => setSelectedPlan('standard')}
                processing={processing}
                formatAmount={formatAmount}
              />
              <PlanCard
                planType="pro"
                selected={selectedPlan === 'pro'}
                onSelect={() => setSelectedPlan('pro')}
                processing={processing}
                popular
                formatAmount={formatAmount}
              />
            </div>
          )}

          {isStandard && (
            <div className="max-w-md">
              <PlanCard
                planType="pro"
                selected={selectedPlan === 'pro'}
                onSelect={() => setSelectedPlan('pro')}
                processing={processing}
                popular
                formatAmount={formatAmount}
              />
            </div>
          )}

          {selectedPlan && (
            <div className="bg-stone-50 border border-stone-200 p-6 space-y-4">
              <div>
                <label className="flex items-center text-sm font-medium text-stone-700 mb-2">
                  <Tag className="w-4 h-4 mr-2" />
                  Coupon Code (Optional)
                </label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setCouponError('');
                  }}
                  placeholder="Enter coupon code"
                  disabled={processing}
                  className="w-full px-4 py-2 border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {couponError && (
                  <p className="text-sm text-red-600 mt-1">{couponError}</p>
                )}
                <p className="text-xs text-stone-500 mt-1">
                  You can also enter or apply a coupon code during checkout
                </p>
              </div>

              <button
                onClick={() => handleUpgrade(selectedPlan)}
                disabled={processing}
                className="w-full bg-stone-900 text-white py-3 px-6 font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {processing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5" />
                    <span>Upgrade to {PLAN_DETAILS[selectedPlan].name}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {isPro && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-amber-600 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-amber-900 text-lg mb-2">You're on the Pro Plan!</h4>
              <p className="text-sm text-amber-800">
                You have access to all features and unlimited usage. Thank you for being a Pro member!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PlanCardProps {
  planType: 'standard' | 'pro';
  selected: boolean;
  onSelect: () => void;
  processing: boolean;
  popular?: boolean;
  formatAmount: (amount: number) => string;
}

function PlanCard({ planType, selected, onSelect, processing, popular, formatAmount }: PlanCardProps) {
  const plan = PLAN_DETAILS[planType];

  return (
    <div
      onClick={!processing ? onSelect : undefined}
      className={`relative border-2 p-6 cursor-pointer transition-all ${
        selected
          ? 'border-stone-900 bg-stone-50'
          : 'border-stone-200 bg-white hover:border-stone-300'
      } ${processing ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-amber-600 text-white px-3 py-1 text-xs font-semibold">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-4">
        <h5 className="text-xl font-bold text-stone-900 mb-1">{plan.name}</h5>
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-stone-900">{formatAmount(plan.priceCents / 100)}</span>
          <span className="text-stone-600 ml-1 text-sm">starting at / month</span>
        </div>
      </div>

      <ul className="space-y-2 mb-4">
        {plan.features.slice(0, 5).map((feature, index) => (
          <li key={index} className="flex items-start text-sm">
            <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-stone-700">{feature}</span>
          </li>
        ))}
        {plan.features.length > 5 && (
          <li className="text-sm text-stone-500 ml-6">
            + {plan.features.length - 5} more features
          </li>
        )}
      </ul>

      <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center ${
        selected ? 'border-stone-900 bg-stone-900' : 'border-stone-300'
      }`}>
        {selected && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>
    </div>
  );
}
