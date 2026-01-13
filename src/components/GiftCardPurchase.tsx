import { useState, useEffect, useCallback } from 'react';
import { Gift, ArrowLeft, Check, CreditCard, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import { useCurrency } from '../lib/currencyContext';
import { useGiftCardCustomization } from '../hooks/useGiftCardCustomization';

// PayPal Script loader
declare global {
  interface Window {
    paypal?: any;
  }
}

interface GiftCardSettings {
  enabled: boolean;
  preset_amounts_cents: number[];
  allow_custom_amount: boolean;
  min_custom_amount_cents: number;
  max_custom_amount_cents: number;
  expiry_days?: number;
}

interface GiftCardPurchaseProps {
  onBack: () => void;
}

export function GiftCardPurchase({ onBack }: GiftCardPurchaseProps) {
  const { businessId } = useTenant();
  const { currencySymbol, formatAmount } = useCurrency();
  const { customization } = useGiftCardCustomization();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GiftCardSettings | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'stripe' | 'paypal'>('stripe');
  const [showPayPalButtons, setShowPayPalButtons] = useState(false);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    checkPaymentSettings();
  }, [businessId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('gift_card_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (data) {
      setSettings(data);
      if (data.preset_amounts_cents && data.preset_amounts_cents.length > 0) {
        setSelectedAmount(data.preset_amounts_cents[0]);
      }
    }
    setLoading(false);
  };

  const checkPaymentSettings = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .eq('business_id', businessId)
      .in('key', ['stripe_enabled', 'paypal_enabled', 'paypal_client_id']);

    if (data) {
      let stripeIsEnabled = false;
      let paypalIsEnabled = false;
      let paypalClientIdValue = '';

      data.forEach((setting) => {
        try {
          const value = JSON.parse(setting.value);
          if (setting.key === 'stripe_enabled') {
            stripeIsEnabled = value === 'true' || value === true;
          } else if (setting.key === 'paypal_enabled') {
            paypalIsEnabled = value === 'true' || value === true;
          } else if (setting.key === 'paypal_client_id') {
            paypalClientIdValue = setting.value;
          }
        } catch {
          if (setting.key === 'paypal_client_id') {
            paypalClientIdValue = setting.value;
          }
        }
      });

      setStripeEnabled(stripeIsEnabled);
      setPaypalEnabled(paypalIsEnabled);
      setPaypalClientId(paypalClientIdValue);

      // Set default payment method
      if (stripeIsEnabled) {
        setSelectedPaymentMethod('stripe');
      } else if (paypalIsEnabled) {
        setSelectedPaymentMethod('paypal');
      }
    }
  };

  // Load PayPal SDK when needed
  useEffect(() => {
    if (paypalEnabled && paypalClientId && selectedPaymentMethod === 'paypal' && !paypalLoaded) {
      loadPayPalScript();
    }
  }, [paypalEnabled, paypalClientId, selectedPaymentMethod]);

  const loadPayPalScript = () => {
    if (window.paypal) {
      setPaypalLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=EUR&intent=capture`;
    script.async = true;
    script.onload = () => {
      setPaypalLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load PayPal SDK');
    };
    document.body.appendChild(script);
  };

  const handlePurchase = async () => {
    setError('');

    const finalAmount = useCustom
      ? Math.round(parseFloat(customAmount) * 100)
      : selectedAmount;

    if (!finalAmount || finalAmount <= 0) {
      setError('Please select or enter a valid amount');
      return;
    }

    if (settings && useCustom) {
      if (finalAmount < settings.min_custom_amount_cents) {
        setError(`Minimum amount is ${formatAmount(settings.min_custom_amount_cents / 100)}`);
        return;
      }
      if (finalAmount > settings.max_custom_amount_cents) {
        setError(`Maximum amount is ${formatAmount(settings.max_custom_amount_cents / 100)}`);
        return;
      }
    }

    if (!buyerEmail || !buyerName) {
      setError('Please enter your name and email');
      return;
    }

    setProcessing(true);

    try {
      // Generate gift card code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_gift_card_code');

      if (codeError || !codeData) {
        throw new Error('Failed to generate gift card code');
      }

      const code = codeData;

      // Calculate expiry
      let expiresAt = null;
      if (settings?.expiry_days) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + settings.expiry_days);
        expiresAt = expiry.toISOString();
      }

      if (stripeEnabled) {
        // Don't create gift card yet - only create after successful payment
        // Pass all necessary data to Stripe checkout
        const checkoutResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              businessId,
              customerEmail: buyerEmail,
              customerName: buyerName,
              amount: finalAmount / 100,
              serviceName: 'Gift Card',
              specialistName: '',
              dateTime: recipientEmail ? `For ${recipientEmail}` : 'For yourself',
              isGiftCard: true,
              giftCardData: {
                code,
                originalValueCents: finalAmount,
                purchasedForEmail: recipientEmail || null,
                expiresAt,
                message: message || null,
              },
            }),
          }
        );

        if (!checkoutResponse.ok) {
          const errorData = await checkoutResponse.json();
          throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const { url } = await checkoutResponse.json();
        window.location.href = url;
      } else {
        // Create gift card directly
        const { data: giftCard, error: giftCardError } = await supabase
          .from('gift_cards')
          .insert({
            business_id: businessId,
            code,
            original_value_cents: finalAmount,
            current_balance_cents: finalAmount,
            purchased_for_email: recipientEmail || null,
            expires_at: expiresAt,
            status: 'active',
          })
          .select()
          .single();

        if (giftCardError) throw giftCardError;

        // Record transaction
        await supabase
          .from('gift_card_transactions')
          .insert({
            gift_card_id: giftCard.id,
            amount_cents: finalAmount,
            transaction_type: 'purchase',
            description: `Purchased by ${buyerName} (${buyerEmail})`,
          });

        // Show success with code
        alert(`Gift card purchased successfully!\n\nYour gift card code: ${code}\n\nAn email has been sent with the details.`);
        onBack();
      }
    } catch (err: any) {
      console.error('Error purchasing gift card:', err);
      setError(err.message || 'Failed to purchase gift card');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!settings || !settings.enabled) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-custom-primary hover:text-custom-primary-hover"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="text-center py-12">
          <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Gift Cards Not Available</h2>
          <p className="text-gray-600">Gift cards are not currently available for purchase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 md:pb-16">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-custom-primary hover:text-custom-primary-hover"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      <div>
        <h1 className="text-3xl font-light text-custom-primary tracking-tight mb-2">
          {customization.title}
        </h1>
        <p className="text-custom-secondary">
          {customization.subtitle}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Select Amount */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          {customization.select_amount_label}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {settings.preset_amounts_cents.map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setSelectedAmount(amount);
                setUseCustom(false);
              }}
              className={`p-4 border-2 rounded-lg text-center transition-colors ${
                !useCustom && selectedAmount === amount
                  ? 'border-custom-primary bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900">
                {formatAmount(amount / 100)}
              </div>
            </button>
          ))}
        </div>

        {settings.allow_custom_amount && (
          <div>
            <button
              onClick={() => setUseCustom(!useCustom)}
              className="text-custom-primary hover:text-custom-primary-hover text-sm font-medium"
            >
              {useCustom ? customization.use_preset_label : customization.enter_custom_label}
            </button>
            {useCustom && (
              <div className="mt-3">
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`Min: ${formatAmount(settings.min_custom_amount_cents / 100)}, Max: ${formatAmount(settings.max_custom_amount_cents / 100)}`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  step="0.01"
                  min={settings.min_custom_amount_cents / 100}
                  max={settings.max_custom_amount_cents / 100}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipient Email */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {customization.recipient_email_label}
        </label>
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="recipient@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500">
          {customization.recipient_email_helper}
        </p>
      </div>

      {/* Message (Optional) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {customization.message_label}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a personal message..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Buyer Details */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-medium text-gray-900">{customization.your_details_label}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {customization.your_name_label}
            </label>
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {customization.your_email_label}
            </label>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        </div>
      </div>

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={processing}
        className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide hover:bg-custom-primary-hover transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-3 mb-8"
      >
        {processing ? (
          'Processing...'
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            {stripeEnabled ? customization.continue_payment_button : customization.complete_purchase_button}
          </>
        )}
      </button>
    </div>
  );
}
