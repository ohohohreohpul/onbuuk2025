import { useState, useEffect } from 'react';
import { User, Calendar, Gift, AlertCircle } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useCustomerAuth } from '../hooks/useCustomerAuth';
import { CustomerAuth } from './customer/CustomerAuth';
import { useTenant } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';

interface WelcomeStepProps {
  onBookAppointment: () => void;
  onPurchaseGiftCard: () => void;
}

export default function WelcomeStep({ onBookAppointment, onPurchaseGiftCard }: WelcomeStepProps) {
  const { getText } = useBookingCustomization();
  const { customer } = useCustomerAuth();
  const { businessId } = useTenant();
  const [showAuth, setShowAuth] = useState(false);
  const [enableBookings, setEnableBookings] = useState(true);
  const [enableGiftCards, setEnableGiftCards] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showCancelledMessage, setShowCancelledMessage] = useState(false);

  useEffect(() => {
    const fetchFeatureFlags = async () => {
      if (!businessId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('businesses')
        .select('enable_bookings, enable_gift_cards')
        .eq('id', businessId)
        .maybeSingle();

      if (data) {
        setEnableBookings(data.enable_bookings ?? true);
        setEnableGiftCards(data.enable_gift_cards ?? true);
      }

      setLoading(false);
    };

    fetchFeatureFlags();

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'cancelled') {
      setShowCancelledMessage(true);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setShowCancelledMessage(false), 8000);
    }
  }, [businessId]);

  const handleAccountClick = () => {
    if (customer) {
      window.location.href = '/account';
    } else {
      setShowAuth(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="space-y-3 sm:space-y-4 flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-custom-primary tracking-tight">
            {getText('welcome', 'title', 'Book Your Appointment')}
          </h1>
          <p className="text-custom-secondary text-base sm:text-lg leading-relaxed">
            {getText('welcome', 'description', 'Select from our available services and choose a time that works best for you. We look forward to serving you!')}
          </p>
        </div>
        <button
          onClick={handleAccountClick}
          className="flex items-center gap-2 px-4 py-2 text-custom-primary hover:bg-stone-100 rounded-lg transition-colors self-start sm:self-auto"
          title={customer ? 'My Account' : 'Sign In'}
        >
          <User className="w-5 h-5" />
          <span className="text-sm">{customer ? 'My Account' : 'Sign In'}</span>
        </button>
      </div>

      {showAuth && <CustomerAuth onClose={() => setShowAuth(false)} />}

      {showCancelledMessage && (
        <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded flex items-start space-x-2 sm:space-x-3 animate-fade-in">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-800 flex-1">
            <p className="font-medium">Payment Cancelled</p>
            <p className="mt-1">Your payment was cancelled. No charges were made. You can try booking again whenever you're ready.</p>
          </div>
          <button
            onClick={() => setShowCancelledMessage(false)}
            className="text-amber-600 hover:text-amber-800 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="space-y-4 sm:space-y-6 pt-2 sm:pt-4">
        <div className="flex items-start space-x-3 sm:space-x-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-stone-800 font-medium mb-1 text-sm sm:text-base">Professional Service</h3>
            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
              Our experienced team is dedicated to providing you with exceptional service.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3 sm:space-x-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-stone-800 font-medium mb-1 text-sm sm:text-base">Flexible Scheduling</h3>
            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
              Choose the time that works best for you with our easy online booking system.
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3 sm:space-x-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-stone-800 font-medium mb-1 text-sm sm:text-base">Easy Process</h3>
            <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
              Simple and straightforward booking in just a few steps. Confirmation sent instantly.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6 sm:pt-8 space-y-3 sm:space-y-4">
        {!enableBookings && !enableGiftCards && (
          <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded flex items-start space-x-2 sm:space-x-3">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-amber-800">
              <p className="font-medium">Online booking is temporarily unavailable</p>
              <p className="mt-1">Please contact us directly to make a booking or purchase a gift card.</p>
            </div>
          </div>
        )}

        {enableBookings && (
          <button
            onClick={onBookAppointment}
            className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-custom-primary text-white text-sm tracking-wide hover:bg-custom-primary-hover transition-colors duration-200 flex items-center justify-center gap-2 sm:gap-3 min-h-[44px] touch-manipulation"
          >
            <Calendar className="w-5 h-5" />
            {getText('welcome', 'button', 'Book an Appointment')}
          </button>
        )}

        {enableGiftCards && (
          <button
            onClick={onPurchaseGiftCard}
            className="w-full px-6 sm:px-8 py-3 sm:py-4 border-2 border-custom-primary text-custom-primary text-sm tracking-wide hover:bg-stone-50 transition-colors duration-200 flex items-center justify-center gap-2 sm:gap-3 min-h-[44px] touch-manipulation"
          >
            <Gift className="w-5 h-5" />
            Purchase a Gift Card
          </button>
        )}
      </div>
    </div>
  );
}
