import { useState, useEffect } from 'react';
import { Gift, ArrowLeft, Check, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import { useCurrency } from '../lib/currencyContext';

interface GiftCardSettings {
  enabled: boolean;
  preset_amounts_cents: number[];
  allow_custom_amount: boolean;
  min_custom_amount_cents: number;
  max_custom_amount_cents: number;
}

interface GiftCardPurchaseProps {
  onBack: () => void;
}

export function GiftCardPurchase({ onBack }: GiftCardPurchaseProps) {
  const { businessId } = useTenant();
  const { currencySymbol, formatAmount } = useCurrency();
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

  useEffect(() => {
    loadSettings();
    checkStripeEnabled();
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

  const checkStripeEnabled = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'stripe_enabled')
      .eq('business_id', businessId)
      .maybeSingle();

    if (data) {
      try {
        const enabled = JSON.parse(data.value);
        setStripeEnabled(enabled === 'true' || enabled === true);
      } catch {
        setStripeEnabled(false);
      }
    }
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
        // Create gift card first
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

        // Create Stripe checkout for gift card
        const checkoutResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              giftCardId: giftCard.id,
              customerEmail: buyerEmail,
              customerName: buyerName,
              amount: finalAmount / 100,
              serviceName: 'Gift Card',
              specialistName: '',
              dateTime: recipientEmail ? `For ${recipientEmail}` : 'For yourself',
              isGiftCard: true,
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
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-custom-primary hover:text-custom-primary-hover"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      <div>
        <h1 className="text-3xl font-light text-custom-primary tracking-tight mb-2">
          Purchase a Gift Card
        </h1>
        <p className="text-custom-secondary">
          Give the gift of choice with a gift card
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
          Select Amount
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
              {useCustom ? 'Use preset amount' : 'Enter custom amount'}
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
          Recipient Email (Optional)
        </label>
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="recipient@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500">
          Leave blank to purchase for yourself, or enter an email to send as a gift
        </p>
      </div>

      {/* Message (Optional) */}
      {recipientEmail && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Personal Message (Optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a personal message..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Buyer Details */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-medium text-gray-900">Your Details</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
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
              Your Email
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
        className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide hover:bg-custom-primary-hover transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {processing ? (
          'Processing...'
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            {stripeEnabled ? 'Continue to Payment' : 'Complete Purchase'}
          </>
        )}
      </button>
    </div>
  );
}
