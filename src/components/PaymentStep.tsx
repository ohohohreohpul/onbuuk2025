import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, CreditCard, Check, Gift, X, AlertCircle, ChevronDown, ChevronUp, ArrowRight, Wallet } from 'lucide-react';
import { supabase, Service, ServiceDuration } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import AccountCreationPrompt from './AccountCreationPrompt';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTheme } from '../lib/themeContext';
import { Button } from './ui/button';

// PayPal Script loader
declare global {
  interface Window {
    paypal?: any;
  }
}

interface SelectedProduct {
  product: {
    id: string;
    name: string;
    price_cents: number;
  };
  quantity: number;
}

interface AppliedGiftCard {
  id: string;
  code: string;
  amountUsedCents: number;
  remainingBalanceCents: number;
}

interface PaymentStepProps {
  bookingData: {
    service: Service;
    duration: ServiceDuration;
    selectedProducts: SelectedProduct[];
    specialistId: string | null;
    date: string;
    time: string;
    isPairBooking: boolean;
    customerDetails: {
      name: string;
      email: string;
      phone: string;
      notes: string;
    };
  };
  onBack: () => void;
}

export default function PaymentStep({ bookingData, onBack }: PaymentStepProps) {
  const tenant = useTenant();
  const { customization } = useBookingCustomization();
  const { colors } = useTheme();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState<boolean>(false);
  const [paypalEnabled, setPaypalEnabled] = useState<boolean>(false);
  const [paypalClientId, setPaypalClientId] = useState<string>('');
  const [allowPayInPerson, setAllowPayInPerson] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'stripe' | 'paypal' | 'in_person'>('stripe');
  const [loading, setLoading] = useState(true);
  const [specialistName, setSpecialistName] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const primaryColor = colors.primary || '#008374';
  const primaryHoverColor = colors.primaryHover || '#006d5f';

  const content = {
    title: customization?.payment_step?.title || 'Review & Pay',
    subtitle: customization?.payment_step?.subtitle || 'Please review your booking details',
    buttonText: customization?.payment_step?.buttonText || 'Confirm Booking'
  };

  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [isValidatingGiftCard, setIsValidatingGiftCard] = useState(false);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [showGiftCardSection, setShowGiftCardSection] = useState(false);

  useEffect(() => {
    checkPaymentStatus();
    if (bookingData.specialistId) {
      fetchSpecialistName();
    }
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  const checkPaymentStatus = async () => {
    if (!tenant.businessId) return;

    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .eq('business_id', tenant.businessId)
      .in('key', ['stripe_enabled', 'allow_pay_in_person', 'paypal_enabled', 'paypal_client_id']);

    if (data) {
      let stripeIsEnabled = false;
      let paypalIsEnabled = false;
      let paypalClientIdValue = '';
      let allowPayInPersonValue = false;

      data.forEach((setting) => {
        try {
          const enabled = JSON.parse(setting.value);
          if (setting.key === 'stripe_enabled') {
            stripeIsEnabled = enabled === 'true' || enabled === true;
          } else if (setting.key === 'allow_pay_in_person') {
            allowPayInPersonValue = enabled === 'true' || enabled === true;
          } else if (setting.key === 'paypal_enabled') {
            paypalIsEnabled = enabled === 'true' || enabled === true;
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
      setAllowPayInPerson(allowPayInPersonValue);

      // Set default payment method based on what's enabled
      if (stripeIsEnabled) {
        setSelectedPaymentMethod('stripe');
      } else if (paypalIsEnabled) {
        setSelectedPaymentMethod('paypal');
      } else if (allowPayInPersonValue) {
        setSelectedPaymentMethod('in_person');
      }
    }
    setLoading(false);
  };

  // Load PayPal SDK when PayPal is selected and enabled
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

  const fetchSpecialistName = async () => {
    if (!bookingData.specialistId || !tenant.businessId) return;

    const { data } = await supabase
      .from('specialists')
      .select('name')
      .eq('id', bookingData.specialistId)
      .eq('business_id', tenant.businessId)
      .maybeSingle();

    if (data) {
      setSpecialistName(data.name);
    }
  };

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) {
      setGiftCardError('Please enter a gift card code');
      return;
    }

    setIsValidatingGiftCard(true);
    setGiftCardError(null);

    try {
      const cleanCode = giftCardCode.trim().toUpperCase();

      const { data: giftCard, error: fetchError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('business_id', tenant.businessId)
        .eq('code', cleanCode)
        .maybeSingle();

      if (fetchError || !giftCard) {
        setGiftCardError('Invalid gift card code');
        setIsValidatingGiftCard(false);
        return;
      }

      if (giftCard.status !== 'active') {
        setGiftCardError('This gift card is no longer active');
        setIsValidatingGiftCard(false);
        return;
      }

      if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
        setGiftCardError('This gift card has expired');
        setIsValidatingGiftCard(false);
        return;
      }

      if (giftCard.current_balance_cents <= 0) {
        setGiftCardError('This gift card has no remaining balance');
        setIsValidatingGiftCard(false);
        return;
      }

      if (appliedGiftCards.some((card) => card.id === giftCard.id)) {
        setGiftCardError('This gift card has already been applied');
        setIsValidatingGiftCard(false);
        return;
      }

      const currentTotal = calculateTotalPrice();
      const currentDiscount = getTotalGiftCardAmount();
      const remainingToPay = Math.max(0, currentTotal - currentDiscount);

      if (remainingToPay <= 0) {
        setGiftCardError('Your booking is already fully covered by gift cards');
        setIsValidatingGiftCard(false);
        return;
      }

      const amountToUse = Math.min(giftCard.current_balance_cents, remainingToPay);

      const newCard: AppliedGiftCard = {
        id: giftCard.id,
        code: giftCard.code,
        amountUsedCents: amountToUse,
        remainingBalanceCents: giftCard.current_balance_cents - amountToUse,
      };

      setAppliedGiftCards([...appliedGiftCards, newCard]);
      setGiftCardCode('');
      setGiftCardError(null);
    } catch (err) {
      console.error('Error validating gift card:', err);
      setGiftCardError('Failed to validate gift card. Please try again.');
    } finally {
      setIsValidatingGiftCard(false);
    }
  };

  const handleRemoveGiftCard = (cardId: string) => {
    setAppliedGiftCards(appliedGiftCards.filter((card) => card.id !== cardId));
  };

  const handleGiftCardKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyGiftCard();
    }
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const createOrUpdateCustomer = async () => {
    if (!tenant.businessId) return null;

    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('business_id', tenant.businessId)
      .eq('email', bookingData.customerDetails.email)
      .maybeSingle();

    if (existingCustomer) {
      return existingCustomer.id;
    }

    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        business_id: tenant.businessId,
        name: bookingData.customerDetails.name,
        email: bookingData.customerDetails.email,
        phone: bookingData.customerDetails.phone,
        total_bookings: 0,
        total_spent_cents: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating customer:', error);
      return null;
    }

    return newCustomer?.id;
  };

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
      if (!tenant.businessId) {
        console.error('Business ID is missing:', tenant);
        throw new Error('Business not found');
      }

      console.log('Creating booking with data:', {
        businessId: tenant.businessId,
        serviceId: bookingData.service.id,
        durationId: bookingData.duration.id,
        specialistId: bookingData.specialistId,
        date: bookingData.date,
        time: bookingData.time
      });

      await createOrUpdateCustomer();

      const isFullyCoveredByGiftCards = finalPrice === 0;
      const shouldUseStripe = selectedPaymentMethod === 'stripe' && stripeEnabled && finalPrice > 0;
      const shouldUsePayPal = selectedPaymentMethod === 'paypal' && paypalEnabled && finalPrice > 0;

      // For PayPal, we need to create the booking first and then the PayPal buttons handle the rest
      if (shouldUsePayPal) {
        console.log('Creating booking for PayPal payment...');
        const { data: createdBooking, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            business_id: tenant.businessId,
            service_id: bookingData.service.id,
            duration_id: bookingData.duration.id,
            specialist_id: bookingData.specialistId,
            booking_date: bookingData.date,
            start_time: bookingData.time,
            customer_name: bookingData.customerDetails.name,
            customer_email: bookingData.customerDetails.email,
            customer_phone: bookingData.customerDetails.phone,
            is_pair_booking: bookingData.isPairBooking,
            notes: bookingData.customerDetails.notes || null,
            payment_status: 'pending',
            status: 'pending',
            gift_card_amount_cents: giftCardDiscount,
            final_amount_cents: finalPrice,
          })
          .select()
          .single();

        if (bookingError) {
          console.error('Booking creation error:', bookingError);
          throw new Error(`Failed to create booking: ${bookingError.message}`);
        }

        // Apply gift cards
        if (appliedGiftCards.length > 0) {
          for (const giftCard of appliedGiftCards) {
            try {
              await supabase.rpc('apply_gift_card_to_booking', {
                p_booking_id: createdBooking.id,
                p_gift_card_id: giftCard.id,
                p_amount_cents: giftCard.amountUsedCents,
              });
            } catch (err) {
              console.error('Error applying gift card:', err);
            }
          }
        }

        // Add products
        if (bookingData.selectedProducts.length > 0) {
          const productInserts = bookingData.selectedProducts.map((sp) => ({
            booking_id: createdBooking.id,
            product_id: sp.product.id,
            quantity: sp.quantity,
            price_cents: sp.product.price_cents,
          }));
          await supabase.from('booking_products').insert(productInserts);
        }

        // Store booking ID for PayPal buttons
        setCreatedBookingId(createdBooking.id);
        setIsProcessing(false);
        return; // PayPal buttons will handle the rest
      }

      if (shouldUseStripe) {
        console.log('Creating booking for Stripe payment...');
        const { data: createdBooking, error: bookingError} = await supabase
          .from('bookings')
          .insert({
            business_id: tenant.businessId,
            service_id: bookingData.service.id,
            duration_id: bookingData.duration.id,
            specialist_id: bookingData.specialistId,
            booking_date: bookingData.date,
            start_time: bookingData.time,
            customer_name: bookingData.customerDetails.name,
            customer_email: bookingData.customerDetails.email,
            customer_phone: bookingData.customerDetails.phone,
            is_pair_booking: bookingData.isPairBooking,
            notes: bookingData.customerDetails.notes || null,
            payment_status: 'pending',
            status: 'pending',
            gift_card_amount_cents: giftCardDiscount,
            final_amount_cents: finalPrice,
          })
          .select()
          .single();

        if (bookingError) {
          console.error('Booking creation error:', bookingError);
          throw new Error(`Failed to create booking: ${bookingError.message}`);
        }

        console.log('Booking created successfully:', createdBooking);

        if (appliedGiftCards.length > 0) {
          console.log('Applying gift cards to booking...');
          for (const giftCard of appliedGiftCards) {
            try {
              const { error: giftCardError } = await supabase.rpc('apply_gift_card_to_booking', {
                p_booking_id: createdBooking.id,
                p_gift_card_id: giftCard.id,
                p_amount_cents: giftCard.amountUsedCents,
              });

              if (giftCardError) {
                console.error('Error applying gift card:', giftCardError);
              }
            } catch (err) {
              console.error('Error applying gift card:', err);
            }
          }
        }

        if (bookingData.selectedProducts.length > 0) {
          console.log('Adding products to booking...');
          const productInserts = bookingData.selectedProducts.map((sp) => ({
            booking_id: createdBooking.id,
            product_id: sp.product.id,
            quantity: sp.quantity,
            price_cents: sp.product.price_cents,
          }));

          const { error: productsError } = await supabase.from('booking_products').insert(productInserts);
          if (productsError) {
            console.error('Error adding products:', productsError);
          }
        }

        const dateTime = `${formatDate(bookingData.date)} at ${bookingData.time}`;

        console.log('Creating Stripe checkout session...');
        const checkoutResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bookingId: createdBooking.id,
              customerEmail: bookingData.customerDetails.email,
              customerName: bookingData.customerDetails.name,
              amount: finalPrice / 100,
              serviceName: bookingData.service.name,
              specialistName: specialistName || 'Any Available Specialist',
              dateTime: dateTime,
            }),
          }
        );

        if (!checkoutResponse.ok) {
          const errorText = await checkoutResponse.text();
          console.error('Checkout session error:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const { url } = await checkoutResponse.json();
        console.log('Redirecting to Stripe checkout:', url);
        window.location.href = url;
      } else {
        const isPayingInPerson = selectedPaymentMethod === 'in_person' && allowPayInPerson;

        console.log('Creating booking without Stripe (pay in person, gift card, or no payment required)...');
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            business_id: tenant.businessId,
            service_id: bookingData.service.id,
            duration_id: bookingData.duration.id,
            specialist_id: bookingData.specialistId,
            booking_date: bookingData.date,
            start_time: bookingData.time,
            customer_name: bookingData.customerDetails.name,
            customer_email: bookingData.customerDetails.email,
            customer_phone: bookingData.customerDetails.phone,
            is_pair_booking: bookingData.isPairBooking,
            notes: bookingData.customerDetails.notes || null,
            payment_status: isFullyCoveredByGiftCards ? 'completed' : (isPayingInPerson ? 'pending' : 'completed'),
            status: isFullyCoveredByGiftCards ? 'confirmed' : (isPayingInPerson ? 'pending' : 'confirmed'),
            gift_card_amount_cents: giftCardDiscount,
            final_amount_cents: finalPrice,
          })
          .select()
          .single();

        if (error) {
          console.error('Booking creation error (pay in person):', error);
          throw new Error(`Failed to create booking: ${error.message}`);
        }

        console.log('Booking created successfully:', data);

        if (appliedGiftCards.length > 0) {
          console.log('Applying gift cards to booking...');
          for (const giftCard of appliedGiftCards) {
            try {
              const { error: giftCardError } = await supabase.rpc('apply_gift_card_to_booking', {
                p_booking_id: data.id,
                p_gift_card_id: giftCard.id,
                p_amount_cents: giftCard.amountUsedCents,
              });

              if (giftCardError) {
                console.error('Error applying gift card:', giftCardError);
              }
            } catch (err) {
              console.error('Error applying gift card:', err);
            }
          }
        }

        if (bookingData.selectedProducts.length > 0) {
          console.log('Adding products to booking...');
          const productInserts = bookingData.selectedProducts.map((sp) => ({
            booking_id: data.id,
            product_id: sp.product.id,
            quantity: sp.quantity,
            price_cents: sp.product.price_cents,
          }));

          const { error: productsError } = await supabase.from('booking_products').insert(productInserts);
          if (productsError) {
            console.error('Error adding products:', productsError);
          }
        }

        console.log('Sending confirmation email...');
        try {
          const calculateEndTime = (startTime: string, durationMinutes: number): string => {
            const [hours, minutes] = startTime.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes + durationMinutes;
            const endHours = Math.floor(totalMinutes / 60) % 24;
            const endMinutes = totalMinutes % 60;
            return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
          };

          const { data: business } = await supabase
            .from('businesses')
            .select('name, address, phone')
            .eq('id', tenant.businessId)
            .maybeSingle();

          const endTime = calculateEndTime(bookingData.time, bookingData.duration.duration_minutes);
          const cancelUrl = `${window.location.origin}/cancel?id=${data.id}`;

          const { error: emailError } = await supabase.functions.invoke('send-business-email', {
            body: {
              business_id: tenant.businessId,
              event_key: 'booking_confirmation',
              recipient_email: bookingData.customerDetails.email,
              recipient_name: bookingData.customerDetails.name,
              variables: {
                customer_name: bookingData.customerDetails.name,
                customer_email: bookingData.customerDetails.email,
                service_name: bookingData.service.name,
                service_duration: `${bookingData.duration.duration_minutes} minutes`,
                service_price: `€${(bookingData.duration.price_cents / 100).toFixed(2)}`,
                booking_date: formatDate(bookingData.date),
                booking_time: bookingData.time,
                booking_end_time: endTime,
                specialist_name: specialistName || 'Any Available Specialist',
                business_name: business?.name || 'Our Business',
                business_address: business?.address || '',
                business_phone: business?.phone || '',
                business_email: '',
                cancellation_link: cancelUrl,
                reschedule_link: cancelUrl,
              },
              booking_id: data.id,
            },
          });

          if (emailError) {
            console.error('Error sending confirmation email:', emailError);
          } else {
            console.log('Confirmation email sent successfully');
          }
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
        }

        setBookingId(data.id);
        setIsComplete(true);
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to create booking: ${errorMessage}\n\nPlease check the console for more details.`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isComplete) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-light text-custom-primary mb-3">{content.title}</h2>
          <p className="text-custom-secondary leading-relaxed">
            Your appointment has been successfully scheduled. We've sent a confirmation email to{' '}
            <span className="font-medium">{bookingData.customerDetails.email}</span>
          </p>
        </div>

        <div className="border border-stone-200 p-6 space-y-4 bg-stone-50">
          <h3 className="text-sm font-medium text-stone-700 uppercase tracking-wider mb-4">
            Booking Details
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Booking ID:</span>
              <span className="text-stone-800 font-medium">{bookingId?.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Service:</span>
              <span className="text-stone-800 font-medium">{bookingData.service.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Duration:</span>
              <span className="text-stone-800 font-medium">{bookingData.duration.duration_minutes} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Date:</span>
              <span className="text-stone-800 font-medium">{formatDate(bookingData.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">Time:</span>
              <span className="text-stone-800 font-medium">{bookingData.time}</span>
            </div>
            {bookingData.isPairBooking && (
              <div className="flex justify-between">
                <span className="text-stone-600">Type:</span>
                <span className="text-stone-800 font-medium">Couples Session</span>
              </div>
            )}
          </div>
        </div>

        <AccountCreationPrompt
          customerEmail={bookingData.customerDetails.email}
          customerName={bookingData.customerDetails.name}
          businessId={tenant.businessId!}
        />

        <div className="text-center text-sm text-stone-600 leading-relaxed">
          Please arrive 10 minutes before your appointment. If you need to reschedule or cancel,
          please contact us at least 24 hours in advance.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const calculateTotalPrice = () => {
    let total = bookingData.duration.price_cents;

    if (bookingData.isPairBooking) {
      total *= 2;
    }

    bookingData.selectedProducts.forEach((sp) => {
      total += sp.product.price_cents * sp.quantity;
    });

    return total;
  };

  const getTotalGiftCardAmount = () => {
    return appliedGiftCards.reduce((sum, card) => sum + card.amountUsedCents, 0);
  };

  const calculateFinalPrice = () => {
    return Math.max(0, calculateTotalPrice() - getTotalGiftCardAmount());
  };

  const totalPrice = calculateTotalPrice();
  const giftCardDiscount = getTotalGiftCardAmount();
  const finalPrice = calculateFinalPrice();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex-shrink-0 mb-6 transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <button
          onClick={onBack}
          className="text-sm mb-4 inline-flex items-center transition-colors group"
          style={{ color: colors.textSecondary }}
          onMouseEnter={(e) => e.currentTarget.style.color = colors.textPrimary || '#171717'}
          onMouseLeave={(e) => e.currentTarget.style.color = colors.textSecondary || '#737373'}
          disabled={isProcessing}
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <h2 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: colors.textPrimary }}>{content.title}</h2>
        <p className="text-lg" style={{ color: colors.textSecondary }}>{content.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pb-6">
        <div className="border border-stone-200 p-6 space-y-4">
        <h3 className="text-sm font-medium text-stone-700 uppercase tracking-wider mb-4">
          Booking Summary
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Service:</span>
            <span className="text-stone-800 font-medium">{bookingData.service.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Duration:</span>
            <span className="text-stone-800 font-medium">{bookingData.duration.duration_minutes} minutes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Date:</span>
            <span className="text-stone-800 font-medium">{formatDate(bookingData.date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Time:</span>
            <span className="text-stone-800 font-medium">{bookingData.time}</span>
          </div>
          {bookingData.isPairBooking && (
            <div className="flex justify-between">
              <span className="text-stone-600">Type:</span>
              <span className="text-stone-800 font-medium">Couples Session</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-stone-600">Name:</span>
            <span className="text-stone-800 font-medium">{bookingData.customerDetails.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Email:</span>
            <span className="text-stone-800 font-medium">{bookingData.customerDetails.email}</span>
          </div>

          {/* Add-Ons Section */}
          {bookingData.selectedProducts && bookingData.selectedProducts.length > 0 && (
            <div className="pt-3 mt-3 border-t border-stone-200">
              <p className="text-stone-600 mb-2 font-medium">Add-Ons:</p>
              <div className="space-y-2 pl-2">
                {bookingData.selectedProducts.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-stone-600">
                      {item.product.name} {item.quantity > 1 && `×${item.quantity}`}
                    </span>
                    <span className="text-stone-800 font-medium">
                      {formatPrice(item.product.price_cents * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 mt-3 border-t border-stone-200">
            {appliedGiftCards.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-600">Subtotal:</span>
                  <span className="text-stone-800">{formatPrice(totalPrice)}</span>
                </div>
                {appliedGiftCards.map((card) => (
                  <div key={card.id} className="flex justify-between text-green-600 text-sm">
                    <span>Gift Card ({card.code}):</span>
                    <span>-{formatPrice(card.amountUsedCents)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-stone-200">
                  <span className="text-stone-800 font-medium">Amount to Pay:</span>
                  <span className="text-xl font-medium text-stone-800">{formatPrice(finalPrice)}</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-stone-800 font-medium">Total:</span>
                <span className="text-xl font-medium text-stone-800">{formatPrice(totalPrice)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

        <div className="border border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={() => setShowGiftCardSection(!showGiftCardSection)}
            className="w-full p-6 flex items-center justify-between hover:bg-stone-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Gift className="w-5 h-5 text-stone-600" />
              <div className="text-left">
                <h3 className="text-sm font-medium text-stone-700">Have a Gift Card?</h3>
                <p className="text-xs text-stone-500">Optional: Apply a gift card to reduce your total</p>
              </div>
            </div>
            {showGiftCardSection ? (
              <ChevronUp className="w-5 h-5 text-stone-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-stone-500" />
            )}
          </button>

          {showGiftCardSection && (
            <div className="px-6 pb-6 space-y-4 border-t border-stone-200">
              <div className="space-y-3 pt-4">
                <div>
                  <label htmlFor="giftCardCode" className="block text-sm text-stone-600 mb-2">
                    Gift Card Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="giftCardCode"
                      value={giftCardCode}
                      onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                      onKeyPress={handleGiftCardKeyPress}
                      placeholder="GC-XXXX-XXXX-XXXX"
                      className="flex-1 px-4 py-2 border border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-400 text-stone-800"
                      disabled={isValidatingGiftCard}
                    />
                    <button
                      onClick={handleApplyGiftCard}
                      disabled={isValidatingGiftCard || !giftCardCode.trim()}
                      className="px-6 py-2 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:bg-stone-400 disabled:cursor-not-allowed"
                    >
                      {isValidatingGiftCard ? 'Validating...' : 'Apply'}
                    </button>
                  </div>
                </div>

                {giftCardError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{giftCardError}</p>
                  </div>
                )}

                {appliedGiftCards.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-medium text-stone-700 uppercase tracking-wider">
                      Applied Gift Cards
                    </h4>
                    {appliedGiftCards.map((card) => (
                      <div
                        key={card.id}
                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-stone-800">{card.code}</p>
                            <p className="text-xs text-stone-600">
                              Applied: {formatPrice(card.amountUsedCents)}
                              {card.remainingBalanceCents > 0 && (
                                <> · Remaining: {formatPrice(card.remainingBalanceCents)}</>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveGiftCard(card.id)}
                          className="p-2 text-stone-500 hover:text-red-600 transition-colors"
                          title="Remove gift card"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Gift cards can cover part or all of your booking. You can apply multiple gift cards to one booking.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border border-stone-200 p-6 bg-stone-50">
          <div className="flex items-center space-x-3 mb-4">
            <CreditCard className="w-5 h-5 text-stone-600" />
            <h3 className="text-sm font-medium text-stone-700">Payment Method</h3>
          </div>

          {(stripeEnabled || paypalEnabled || allowPayInPerson) && finalPrice > 0 ? (
            <div className="space-y-3">
              {stripeEnabled && (
                <button
                  onClick={() => setSelectedPaymentMethod('stripe')}
                  disabled={createdBookingId !== null}
                  className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                    selectedPaymentMethod === 'stripe'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-stone-300 hover:border-stone-400'
                  } ${createdBookingId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-stone-600" />
                      <div>
                        <p className="font-medium text-stone-800">Pay with Card</p>
                        <p className="text-xs text-stone-600">Secure payment via Stripe</p>
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
                  disabled={createdBookingId !== null}
                  className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                    selectedPaymentMethod === 'paypal'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-stone-300 hover:border-stone-400'
                  } ${createdBookingId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-stone-800">Pay with PayPal</p>
                        <p className="text-xs text-stone-600">PayPal, Credit/Debit Card, Pay Later</p>
                      </div>
                    </div>
                    {selectedPaymentMethod === 'paypal' && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </button>
              )}

              {allowPayInPerson && (
                <button
                  onClick={() => setSelectedPaymentMethod('in_person')}
                  disabled={createdBookingId !== null}
                  className={`w-full p-4 border-2 rounded-lg transition-colors text-left ${
                    selectedPaymentMethod === 'in_person'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-stone-300 hover:border-stone-400'
                  } ${createdBookingId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 text-stone-600">💵</div>
                      <div>
                        <p className="font-medium text-stone-800">Pay in Person</p>
                        <p className="text-xs text-stone-600">Pay when you arrive</p>
                      </div>
                    </div>
                    {selectedPaymentMethod === 'in_person' && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-600 leading-relaxed">
              {finalPrice === 0
                ? 'Your booking is fully covered by gift cards. No payment is required.'
                : 'Payment will be processed securely. Click "Confirm Booking" to proceed.'}
            </p>
          )}

          {/* PayPal Buttons - Show when PayPal is selected and booking is created */}
          {selectedPaymentMethod === 'paypal' && paypalEnabled && createdBookingId && paypalLoaded && finalPrice > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-200">
              <p className="text-sm text-stone-600 mb-3">Complete your payment with PayPal:</p>
              <PayPalButtonContainer
                bookingId={createdBookingId}
                businessId={tenant.businessId!}
                amount={finalPrice / 100}
                customerEmail={bookingData.customerDetails.email}
                customerName={bookingData.customerDetails.name}
                serviceName={bookingData.service.name}
                specialistName={specialistName || 'Any Available Specialist'}
                dateTime={`${formatDate(bookingData.date)} at ${bookingData.time}`}
                onSuccess={(orderId) => {
                  console.log('PayPal payment successful:', orderId);
                  setBookingId(createdBookingId);
                  setIsComplete(true);
                }}
                onError={(error) => {
                  console.error('PayPal payment error:', error);
                  alert(`Payment failed: ${error}`);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer - Sticky at bottom */}
      <div 
        className={`flex-shrink-0 space-y-4 pt-4 mt-auto transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ 
          borderTopWidth: 1,
          borderTopColor: colors.border || '#e5e5e5',
        }}
      >
        {/* Hide the button when PayPal is selected and booking is created (PayPal buttons take over) */}
        {!(selectedPaymentMethod === 'paypal' && createdBookingId) && (
        <Button
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full h-14 text-base transition-all duration-300 group text-white disabled:opacity-50"
          size="lg"
          style={{
            background: !isProcessing 
              ? primaryColor
              : '#9ca3af',
            boxShadow: !isProcessing ? `0 4px 14px -3px ${primaryColor}50` : 'none',
          }}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
              Processing...
            </span>
          ) : finalPrice === 0 ? (
            <>
              Complete Booking - Paid with Gift Card
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </>
          ) : selectedPaymentMethod === 'in_person' ? (
            <>
              Confirm Booking - Pay in Person
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </>
          ) : (
            <>
              Confirm & Pay {formatPrice(finalPrice)}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>

        <p className="text-xs text-center leading-relaxed" style={{ color: colors.textSecondary }}>
          By confirming this booking, you agree to our cancellation policy.
          Cancellations must be made at least 24 hours in advance.
        </p>
      </div>
    </div>
  );
}
