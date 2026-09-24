import { useState, useEffect, useCallback } from 'react';
import { Gift, ArrowLeft, Check, CreditCard, Wallet, Package, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import { useCurrency } from '../lib/currencyContext';
import { useGiftCardCustomization } from '../hooks/useGiftCardCustomization';

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

interface ServicePassOffer {
  id: string;
  name: string;
  description: string | null;
  service_id: string;
  duration_id: string;
  visit_count: number;
  price_cents: number;
  expiry_days: number | null;
  services?: { name: string } | null;
  service_durations?: { duration_minutes: number; price_cents: number } | null;
}

export function GiftCardPurchase({ onBack }: GiftCardPurchaseProps) {
  const { businessId } = useTenant();
  const { currency, formatAmount } = useCurrency();
  const { customization } = useGiftCardCustomization();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<GiftCardSettings | null>(null);
  const [purchaseType, setPurchaseType] = useState<'value' | 'service_pass'>('value');
  const [servicePassOffers, setServicePassOffers] = useState<ServicePassOffer[]>([]);
  const [selectedServicePassId, setSelectedServicePassId] = useState('');
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
    const [settingsResult, passesResult] = await Promise.all([
      supabase
        .from('gift_card_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase
        .from('service_pass_offers')
        .select('*, services(name), service_durations(duration_minutes, price_cents)')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
    ]);

    const data = settingsResult.data;

    if (data) {
      setSettings(data);
      if (data.preset_amounts_cents && data.preset_amounts_cents.length > 0) {
        setSelectedAmount(data.preset_amounts_cents[0]);
      }
    }
    if (passesResult.data) {
      const normalizedOffers = passesResult.data.map((offer) => ({
        ...offer,
        services: Array.isArray(offer.services) ? offer.services[0] || null : offer.services,
        service_durations: Array.isArray(offer.service_durations) ? offer.service_durations[0] || null : offer.service_durations,
      })) as ServicePassOffer[];
      setServicePassOffers(normalizedOffers);
      setSelectedServicePassId(passesResult.data[0]?.id || '');
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
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=${currency}&intent=capture`;
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

    const selectedServicePass = servicePassOffers.find((offer) => offer.id === selectedServicePassId);

    const finalAmount = purchaseType === 'service_pass'
      ? selectedServicePass?.price_cents || 0
      : useCustom
        ? Math.round(parseFloat(customAmount) * 100)
        : selectedAmount;

    if (purchaseType === 'service_pass' && !selectedServicePass) {
      setError('Please choose a service pass');
      return;
    }

    if (!finalAmount || finalAmount <= 0) {
      setError('Please select or enter a valid amount');
      return;
    }

    if (purchaseType === 'value' && settings && useCustom) {
      if (finalAmount < settings.min_custom_amount_cents) {
        setError(`Minimum amount is ${formatAmount(settings.min_custom_amount_cents / 100)}`);
        return;
      }
      if (finalAmount > settings.max_custom_amount_cents) {
        setError(`Maximum amount is ${formatAmount(settings.max_custom_amount_cents / 100)}`);
        return;
      }
    }

    if (!recipientEmail) {
      setError('Please enter the recipient\'s email address');
      return;
    }

    // Validate recipient email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      setError('Please enter a valid recipient email address');
      return;
    }

    if (!buyerName) {
      setError('Please enter your name');
      return;
    }

    if (!buyerEmail) {
      setError('Please enter your email address');
      return;
    }

    // Validate buyer email format
    if (!emailRegex.test(buyerEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setProcessing(true);

    try {
      // Calculate expiry
      let calculatedExpiresAt: string | null = null;
      const expiryDays = purchaseType === 'service_pass'
        ? selectedServicePass?.expiry_days ?? settings?.expiry_days
        : settings?.expiry_days;
      if (expiryDays) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + expiryDays);
        calculatedExpiresAt = expiry.toISOString();
      }

      // Generate gift card code for all payment methods
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_gift_card_code', { p_business_id: businessId });

      if (codeError || !codeData) {
        throw new Error('Failed to generate gift card code');
      }

      const code = codeData;

      // For PayPal, show PayPal buttons
      if (selectedPaymentMethod === 'paypal' && paypalEnabled) {
        setGiftCardCode(code);
        setExpiresAt(calculatedExpiresAt);
        setShowPayPalButtons(true);
        setProcessing(false);
        return;
      }

      if (selectedPaymentMethod === 'stripe' && stripeEnabled) {
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
              serviceName: purchaseType === 'service_pass' ? selectedServicePass?.name || 'Service Pass' : 'Gift Card',
              specialistName: '',
              dateTime: recipientEmail ? `For ${recipientEmail}` : 'For yourself',
              isGiftCard: true,
              giftCardData: {
                code,
                cardType: purchaseType,
                servicePassOfferId: purchaseType === 'service_pass' ? selectedServicePass?.id : null,
                originalValueCents: finalAmount,
                purchasedForEmail: recipientEmail || null,
                expiresAt: calculatedExpiresAt,
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
        // Create gift card directly (no online payment)
        const directCardPayload = purchaseType === 'service_pass' && selectedServicePass
          ? {
              business_id: businessId,
              code,
              card_type: 'service_pass',
              service_pass_offer_id: selectedServicePass.id,
              service_pass_name: selectedServicePass.name,
              service_id: selectedServicePass.service_id,
              duration_id: selectedServicePass.duration_id,
              original_visits: selectedServicePass.visit_count,
              remaining_visits: selectedServicePass.visit_count,
              purchase_price_cents: selectedServicePass.price_cents,
              original_value_cents: 0,
              current_balance_cents: 0,
              purchased_for_email: recipientEmail || null,
              purchased_by_email: buyerEmail || null,
              purchased_by_name: buyerName || null,
              expires_at: calculatedExpiresAt,
              status: 'active',
            }
          : {
              business_id: businessId,
              code,
              card_type: 'value',
              purchase_price_cents: finalAmount,
              original_value_cents: finalAmount,
              current_balance_cents: finalAmount,
              purchased_for_email: recipientEmail || null,
              purchased_by_email: buyerEmail || null,
              purchased_by_name: buyerName || null,
              expires_at: calculatedExpiresAt,
              status: 'active',
            };

        const { data: giftCard, error: giftCardError } = await supabase
          .from('gift_cards')
          .insert(directCardPayload)
          .select()
          .single();

        if (giftCardError) throw giftCardError;

        // Record transaction
        await supabase
          .from('gift_card_transactions')
          .insert({
            gift_card_id: giftCard.id,
            amount_cents: finalAmount,
            visit_count: purchaseType === 'service_pass' ? selectedServicePass?.visit_count || 0 : 0,
            transaction_type: 'purchase',
            description: `${purchaseType === 'service_pass' ? 'Service pass' : 'Gift card'} purchased by ${buyerName} (${buyerEmail})`,
          });

        // Show success with code
        const purchasedProduct = purchaseType === 'service_pass' ? 'Service pass' : 'Gift card';
        alert(`${purchasedProduct} purchased successfully!\n\nYour code: ${code}\n\nAn email has been sent with the details.`);
        onBack();
      }
    } catch (err: any) {
      console.error('Error purchasing gift card:', err);
      setError(err.message || 'Failed to purchase gift card');
    } finally {
      setProcessing(false);
    }
  };

  const getFinalAmount = () => {
    if (purchaseType === 'service_pass') {
      return servicePassOffers.find((offer) => offer.id === selectedServicePassId)?.price_cents || 0;
    }
    return useCustom
      ? Math.round(parseFloat(customAmount) * 100)
      : selectedAmount || 0;
  };

  const selectedServicePass = servicePassOffers.find((offer) => offer.id === selectedServicePassId);

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

      {servicePassOffers.length > 0 && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/80 bg-white/60 p-1.5 shadow-[0_16px_45px_-36px_rgba(28,25,23,0.6)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setPurchaseType('value')}
            className={`rounded-xl px-4 py-3 text-left transition ${purchaseType === 'value' ? 'bg-[#1A1714] text-white shadow-lg' : 'text-stone-500 hover:bg-white/70 hover:text-stone-800'}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold"><Gift className="h-4 w-4" /> Value card</span>
            <span className={`mt-1 block text-xs ${purchaseType === 'value' ? 'text-white/55' : 'text-stone-400'}`}>Choose an amount to spend freely</span>
          </button>
          <button
            type="button"
            onClick={() => setPurchaseType('service_pass')}
            className={`rounded-xl px-4 py-3 text-left transition ${purchaseType === 'service_pass' ? 'bg-[#1A1714] text-white shadow-lg' : 'text-stone-500 hover:bg-white/70 hover:text-stone-800'}`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4" /> Service pass</span>
            <span className={`mt-1 block text-xs ${purchaseType === 'service_pass' ? 'text-white/55' : 'text-stone-400'}`}>Gift one visit or a package</span>
          </button>
        </div>
      )}

      {/* Select Amount */}
      {purchaseType === 'value' ? (
      <div className="space-y-3 rounded-[24px] border border-white/80 bg-white/[0.68] p-5 shadow-[0_18px_45px_-34px_rgba(28,25,23,0.45)] backdrop-blur-xl">
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
      ) : (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Choose a service pass</h2>
            <p className="mt-1 text-xs text-stone-500">Each visit is redeemable only for the service and duration shown.</p>
          </div>
          <div className="grid gap-3">
            {servicePassOffers.map((offer) => {
              const selected = selectedServicePassId === offer.id;
              const standardValue = (offer.service_durations?.price_cents || 0) * offer.visit_count;
              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setSelectedServicePassId(offer.id)}
                  className={`group rounded-[22px] border p-5 text-left transition-all ${selected ? 'border-[#1A1714] bg-[#1A1714] text-white shadow-[0_18px_45px_-25px_rgba(26,23,20,0.5)]' : 'border-white/90 bg-white/[0.68] text-stone-800 shadow-[0_16px_42px_-36px_rgba(28,25,23,0.55)] backdrop-blur-xl hover:border-stone-300'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Package className={`h-4 w-4 ${selected ? 'text-white/75' : 'text-violet-600'}`} />
                        <span className="font-semibold tracking-tight">{offer.name}</span>
                      </div>
                      <p className={`mt-2 text-sm ${selected ? 'text-white/60' : 'text-stone-500'}`}>
                        {offer.services?.name || 'Service'} · {offer.service_durations?.duration_minutes || '—'} minutes
                      </p>
                      {offer.description && <p className={`mt-2 text-xs leading-5 ${selected ? 'text-white/45' : 'text-stone-400'}`}>{offer.description}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-semibold tracking-tight">{formatAmount(offer.price_cents / 100)}</p>
                      <p className={`mt-1 text-xs ${selected ? 'text-white/50' : 'text-stone-400'}`}>{offer.visit_count} {offer.visit_count === 1 ? 'visit' : 'visits'}</p>
                    </div>
                  </div>
                  <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs ${selected ? 'border-white/10 text-white/50' : 'border-stone-200/70 text-stone-400'}`}>
                    <span>One code · {offer.visit_count} redemption{offer.visit_count === 1 ? '' : 's'}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{offer.expiry_days ? `${offer.expiry_days} days` : 'Standard expiry'}</span>
                    {standardValue > offer.price_cents && <span>Standard value {formatAmount(standardValue / 100)}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recipient Email */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {customization.recipient_email_label} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="recipient@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
        <p className="text-xs text-gray-500">
          {customization.recipient_email_helper}
        </p>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {customization.message_label} <span className="text-gray-400 text-xs font-normal">(Optional)</span>
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
              {customization.your_name_label} <span className="text-red-500">*</span>
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
              {customization.your_email_label} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll send you a confirmation email with the card or pass details
            </p>
          </div>
        </div>
      </div>

      {/* Payment Method Selection */}
      {(stripeEnabled || paypalEnabled) && !showPayPalButtons && (
        <div className="space-y-3 pt-4 border-t">
          <h3 className="font-medium text-gray-900">Payment Method</h3>
          <div className="space-y-2">
            {stripeEnabled && (
              <button
                onClick={() => setSelectedPaymentMethod('stripe')}
                className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                  selectedPaymentMethod === 'stripe'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-800">Pay with Card</p>
                      <p className="text-xs text-gray-600">Secure payment via Stripe</p>
                    </div>
                  </div>
                  {selectedPaymentMethod === 'stripe' && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
            )}

            {paypalEnabled && (
              <button
                onClick={() => setSelectedPaymentMethod('paypal')}
                className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                  selectedPaymentMethod === 'paypal'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-800">Pay with PayPal</p>
                      <p className="text-xs text-gray-600">PayPal, Credit/Debit Card, Pay Later</p>
                    </div>
                  </div>
                  {selectedPaymentMethod === 'paypal' && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* PayPal Buttons */}
      {showPayPalButtons && paypalLoaded && (
        <div className="space-y-3 pt-4 border-t">
          <h3 className="font-medium text-gray-900">Complete Payment with PayPal</h3>
          <GiftCardPayPalButtons
            businessId={businessId!}
            amount={getFinalAmount() / 100}
            customerEmail={buyerEmail}
            customerName={buyerName}
            serviceName={purchaseType === 'service_pass' ? selectedServicePass?.name || 'Service Pass' : 'Gift Card'}
            giftCardData={{
              code: giftCardCode,
              cardType: purchaseType,
              servicePassOfferId: purchaseType === 'service_pass' ? selectedServicePass?.id || null : null,
              originalValueCents: getFinalAmount(),
              purchasedForEmail: recipientEmail || null,
              expiresAt: expiresAt,
              message: message || null,
            }}
            onSuccess={() => {
              const purchasedProduct = purchaseType === 'service_pass' ? 'Service pass' : 'Gift card';
              alert(`${purchasedProduct} purchased successfully!\n\nYour code: ${giftCardCode}\n\nAn email has been sent with the details.`);
              onBack();
            }}
            onError={(err) => {
              setError(err);
              setShowPayPalButtons(false);
            }}
          />
          <button
            onClick={() => setShowPayPalButtons(false)}
            className="w-full text-sm text-gray-600 hover:text-gray-800"
          >
            ← Choose different payment method
          </button>
        </div>
      )}

      {/* Purchase Button - Hide when showing PayPal buttons */}
      {!showPayPalButtons && (
        <button
          onClick={handlePurchase}
          disabled={processing}
          className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide hover:bg-custom-primary-hover transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-3 mb-8"
        >
          {processing ? (
            'Processing...'
          ) : (
            <>
              {selectedPaymentMethod === 'paypal' ? (
                <Wallet className="w-5 h-5" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
              {stripeEnabled || paypalEnabled ? customization.continue_payment_button : customization.complete_purchase_button}
            </>
          )}
        </button>
      )}
    </div>
  );
}

// PayPal Button Container for Gift Cards
interface GiftCardPayPalButtonsProps {
  businessId: string;
  amount: number;
  customerEmail: string;
  customerName: string;
  serviceName: string;
  giftCardData: {
    code: string;
    cardType: 'value' | 'service_pass';
    servicePassOfferId: string | null;
    originalValueCents: number;
    purchasedForEmail: string | null;
    expiresAt: string | null;
    message: string | null;
  };
  onSuccess: () => void;
  onError: (error: string) => void;
}

function GiftCardPayPalButtons({
  businessId,
  amount,
  customerEmail,
  customerName,
  serviceName,
  giftCardData,
  onSuccess,
  onError,
}: GiftCardPayPalButtonsProps) {
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node && window.paypal) {
      node.innerHTML = '';
      
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
        },
        createOrder: async () => {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-paypal-order`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  businessId,
                  amount,
                  customerEmail,
                  customerName,
                  serviceName,
                  dateTime: giftCardData.purchasedForEmail ? `For ${giftCardData.purchasedForEmail}` : 'For yourself',
                  isGiftCard: true,
                  giftCardData,
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create PayPal order');
            }

            const { orderId } = await response.json();
            return orderId;
          } catch (error: any) {
            console.error('Error creating PayPal order:', error);
            onError(error.message || 'Failed to create PayPal order');
            throw error;
          }
        },
        onApprove: async (data: any) => {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-paypal-order`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  orderId: data.orderID,
                  businessId,
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to capture PayPal order');
            }

            const result = await response.json();
            if (result.success) {
              onSuccess();
            } else {
              throw new Error('Payment capture failed');
            }
          } catch (error: any) {
            console.error('Error capturing PayPal order:', error);
            onError(error.message || 'Failed to complete payment');
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err);
          onError('PayPal encountered an error. Please try again.');
        },
        onCancel: () => {
          console.log('PayPal payment cancelled');
        },
      }).render(node);
    }
  }, [businessId, amount, customerEmail, customerName, serviceName, giftCardData, onSuccess, onError]);

  return <div ref={containerRef} />;
}
