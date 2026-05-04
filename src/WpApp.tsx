/**
 * WordPress-embedded entry point.
 * Only renders the booking widget (no admin, landing, or sign-up flows).
 * Post-payment pages are handled via the ?buuk_mode query param:
 *   ?buuk_mode=booking-success
 *   ?buuk_mode=gift-card-success
 *   ?buuk_mode=payment-cancelled
 *   ?buuk_mode=cancel
 */
import { useState } from 'react';
import BookingLayout from './components/BookingLayout';
import WelcomeStep from './components/WelcomeStep';
import ServiceStep from './components/ServiceStep';
import DurationStep from './components/DurationStep';
import AddOnsStep from './components/AddOnsStep';
import SpecialistStep from './components/SpecialistStep';
import DateTimeStep from './components/DateTimeStep';
import PersonalDetailsStep from './components/PersonalDetailsStep';
import PaymentStep from './components/PaymentStep';
import CancelBooking from './components/CancelBooking';
import BookingSuccess from './components/BookingSuccess';
import GiftCardSuccess from './components/GiftCardSuccess';
import PaymentCancelled from './components/PaymentCancelled';
import { GiftCardPurchase } from './components/GiftCardPurchase';
import { NoBusinessFound } from './components/NoBusinessFound';
import { TenantProvider } from './components/TenantProvider';
import { DynamicBranding } from './components/DynamicBranding';
import { useTenant } from './lib/tenantContext';
import { useBookingCustomization } from './hooks/useBookingCustomization';
import { CurrencyProvider } from './lib/currencyContext';
import { ThemeProvider } from './lib/themeContext';
import { supabase, Service, ServiceDuration } from './lib/supabase';

type Step =
  | 'welcome'
  | 'service'
  | 'duration'
  | 'addons'
  | 'specialist'
  | 'datetime'
  | 'details'
  | 'payment'
  | 'giftcard';

type WpMode =
  | 'booking'
  | 'cancel'
  | 'booking-success'
  | 'gift-card-success'
  | 'payment-cancelled';

interface SelectedProduct {
  product: { id: string; name: string; price_cents: number };
  quantity: number;
}

interface BookingState {
  service: Service | null;
  duration: ServiceDuration | null;
  selectedProducts: SelectedProduct[];
  specialistId: string | null;
  date: string;
  time: string;
  isPairBooking: boolean;
  customerDetails: { name: string; email: string; phone: string; notes: string };
}

function resolveWpMode(): WpMode {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('buuk_mode') ?? '';
  const valid: WpMode[] = [
    'booking',
    'cancel',
    'booking-success',
    'gift-card-success',
    'payment-cancelled',
  ];
  return valid.includes(raw as WpMode) ? (raw as WpMode) : 'booking';
}

function WpAppContent() {
  const tenant = useTenant();
  const { customization } = useBookingCustomization();
  const [wpMode] = useState<WpMode>(resolveWpMode);
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [specialistName, setSpecialistName] = useState<string | null>(null);
  const [bookingState, setBookingState] = useState<BookingState>({
    service: null,
    duration: null,
    selectedProducts: [],
    specialistId: null,
    date: '',
    time: '',
    isPairBooking: false,
    customerDetails: { name: '', email: '', phone: '', notes: '' },
  });

  if (wpMode === 'booking-success') return <BookingSuccess />;
  if (wpMode === 'gift-card-success') return <GiftCardSuccess />;
  if (wpMode === 'payment-cancelled') return <PaymentCancelled />;
  if (wpMode === 'cancel') return <CancelBooking />;

  if (tenant.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">Loading...</div>
      </div>
    );
  }

  if (!tenant.businessId) return <NoBusinessFound />;

  const checkForProducts = async (serviceId: string): Promise<boolean> => {
    if (!tenant.businessId) return false;
    const { data } = await supabase
      .from('product_service_assignments')
      .select('product_id')
      .eq('business_id', tenant.businessId)
      .or(`service_id.eq.${serviceId},service_id.is.null`)
      .limit(1);
    return (data && data.length > 0) || false;
  };

  const handleServiceSelect = (service: Service, isPairBooking: boolean) => {
    setBookingState({ ...bookingState, service, isPairBooking });
    setCurrentStep('duration');
  };

  const handleDurationSelect = async (duration: ServiceDuration) => {
    setBookingState({ ...bookingState, duration });
    if (tenant.businessId && bookingState.service) {
      const hasProducts = await checkForProducts(bookingState.service.id);
      setCurrentStep(hasProducts ? 'addons' : 'specialist');
    } else {
      setCurrentStep('addons');
    }
  };

  const handleAddOnsSelect = (selectedProducts: SelectedProduct[]) => {
    setBookingState({ ...bookingState, selectedProducts });
    setCurrentStep('specialist');
  };

  const handleSpecialistSelect = async (specialistId: string | null) => {
    setBookingState({ ...bookingState, specialistId });
    if (specialistId && tenant.businessId) {
      const { data } = await supabase
        .from('specialists')
        .select('name')
        .eq('id', specialistId)
        .eq('business_id', tenant.businessId)
        .maybeSingle();
      setSpecialistName(data?.name || null);
    } else {
      setSpecialistName(null);
    }
    setCurrentStep('datetime');
  };

  const handleSpecialistBack = async () => {
    if (tenant.businessId && bookingState.service) {
      const hasProducts = await checkForProducts(bookingState.service.id);
      setCurrentStep(hasProducts ? 'addons' : 'duration');
    } else {
      setCurrentStep('duration');
    }
  };

  const getCurrentStepImage = (): string | undefined => {
    if (!customization) return undefined;
    if (customization.global_image_url) return customization.global_image_url;
    const map: Record<Step, string | null> = {
      welcome: customization.welcome_image_url,
      service: customization.service_image_url,
      duration: customization.duration_image_url,
      specialist: customization.specialist_image_url,
      datetime: customization.datetime_image_url,
      details: customization.details_image_url,
      addons: customization.addons_image_url,
      payment: customization.payment_image_url,
      giftcard: customization.welcome_image_url,
    };
    return map[currentStep] || undefined;
  };

  const getCurrentStepResponsiveImages = () => {
    if (!customization) return {};
    const stepKey = currentStep === 'giftcard' ? 'welcome' : currentStep;
    return {
      mobile: customization[`${stepKey}_image_mobile` as keyof typeof customization] as string | undefined,
      tablet: customization[`${stepKey}_image_tablet` as keyof typeof customization] as string | undefined,
      desktop: customization[`${stepKey}_image_desktop` as keyof typeof customization] as string | undefined,
    };
  };

  const buildBookingSummary = () => ({
    service: bookingState.service?.name,
    serviceType: bookingState.isPairBooking ? 'Couple' : 'Individual',
    duration: bookingState.duration ? `${bookingState.duration.duration_minutes} minutes` : undefined,
    specialist: specialistName || undefined,
    date: bookingState.date,
    time: bookingState.time,
    addOns: bookingState.selectedProducts.length > 0 ? bookingState.selectedProducts : undefined,
  });

  const responsive = getCurrentStepResponsiveImages();

  return (
    <ThemeProvider>
      <BookingLayout
        imageUrl={getCurrentStepImage()}
        imageMobile={responsive.mobile}
        imageTablet={responsive.tablet}
        imageDesktop={responsive.desktop}
        bookingSummary={buildBookingSummary()}
      >
        {currentStep === 'welcome' && (
          <WelcomeStep
            onBookAppointment={() => setCurrentStep('service')}
            onPurchaseGiftCard={() => setCurrentStep('giftcard')}
          />
        )}
        {currentStep === 'giftcard' && (
          <GiftCardPurchase onBack={() => setCurrentStep('welcome')} />
        )}
        {currentStep === 'service' && (
          <ServiceStep onNext={handleServiceSelect} onBack={() => setCurrentStep('welcome')} />
        )}
        {currentStep === 'duration' && bookingState.service && (
          <DurationStep
            serviceId={bookingState.service.id}
            isPairBooking={bookingState.isPairBooking}
            onNext={handleDurationSelect}
            onBack={() => setCurrentStep('service')}
          />
        )}
        {currentStep === 'addons' && bookingState.service && (
          <AddOnsStep
            serviceId={bookingState.service.id}
            onNext={handleAddOnsSelect}
            onBack={() => setCurrentStep('duration')}
          />
        )}
        {currentStep === 'specialist' && bookingState.service && (
          <SpecialistStep
            serviceId={bookingState.service.id}
            onNext={handleSpecialistSelect}
            onBack={handleSpecialistBack}
          />
        )}
        {currentStep === 'datetime' && (
          <DateTimeStep
            onNext={(date, time) => {
              setBookingState({ ...bookingState, date, time });
              setCurrentStep('details');
            }}
            onBack={() => setCurrentStep('specialist')}
          />
        )}
        {currentStep === 'details' && (
          <PersonalDetailsStep
            onNext={(details) => {
              setBookingState({ ...bookingState, customerDetails: details });
              setCurrentStep('payment');
            }}
            onBack={() => setCurrentStep('datetime')}
          />
        )}
        {currentStep === 'payment' && bookingState.service && bookingState.duration && (
          <PaymentStep
            bookingData={{
              service: bookingState.service,
              duration: bookingState.duration,
              selectedProducts: bookingState.selectedProducts,
              specialistId: bookingState.specialistId,
              date: bookingState.date,
              time: bookingState.time,
              isPairBooking: bookingState.isPairBooking,
              customerDetails: bookingState.customerDetails,
            }}
            onBack={() => setCurrentStep('details')}
          />
        )}
      </BookingLayout>
    </ThemeProvider>
  );
}

export default function WpApp() {
  return (
    <TenantProvider>
      <CurrencyProvider>
        <DynamicBranding />
        <WpAppContent />
      </CurrencyProvider>
    </TenantProvider>
  );
}
