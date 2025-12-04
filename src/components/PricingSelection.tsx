import { useState } from 'react';
import { Check, ArrowLeft, Loader2 } from 'lucide-react';

interface PricingSelectionProps {
  onSelectPlan: (planType: 'standard' | 'pro') => Promise<void>;
  onBack: () => void;
}

export function PricingSelection({ onSelectPlan, onBack }: PricingSelectionProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'pro' | null>(null);

  const handleSelectPlan = async (planType: 'standard' | 'pro') => {
    setSelectedPlan(planType);
    setLoading(true);
    try {
      await onSelectPlan(planType);
    } catch (error) {
      console.error('Error selecting plan:', error);
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      id: 'standard',
      name: 'Standard',
      price: '$29',
      period: '/month',
      description: 'Perfect for small businesses getting started',
      features: [
        'Up to 3 staff members',
        'Up to 10 services',
        'Online booking system',
        'Email notifications',
        'Basic analytics',
        'Customer management',
      ],
      popular: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$79',
      period: '/month',
      description: 'Advanced features for growing businesses',
      features: [
        'Unlimited staff members',
        'Unlimited services',
        'Everything in Standard',
        'Remove "Powered by Buuk" badge',
        'Custom branding & logos',
        'Calendar integrations',
        'Priority support',
      ],
      popular: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        <button
          onClick={onBack}
          disabled={loading}
          className="mb-8 flex items-center text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-slate-600">
            Select the plan that best fits your business needs
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white shadow-xl p-8 border-2 transition-all ${
                plan.popular
                  ? 'border-slate-900'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-slate-900 text-white px-4 py-1 text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-slate-600 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline">
                  <span className="text-5xl font-bold text-slate-900">
                    {plan.price}
                  </span>
                  <span className="text-slate-600 ml-2">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id as 'standard' | 'pro')}
                disabled={loading}
                className={`w-full py-4 font-semibold transition-all disabled:opacity-50 flex items-center justify-center ${
                  plan.popular
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                }`}
              >
                {loading && selectedPlan === plan.id ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Get Started with ${plan.name}`
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-600">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </div>
  );
}
