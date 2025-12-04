import { useState, useEffect } from 'react';
import BookingLayout from './components/BookingLayout';
import WelcomeStep from './components/WelcomeStep';
import ServiceStep from './components/ServiceStep';
import DurationStep from './components/DurationStep';
import AddOnsStep from './components/AddOnsStep';
import SpecialistStep from './components/SpecialistStep';
import DateTimeStep from './components/DateTimeStep';
import PersonalDetailsStep from './components/PersonalDetailsStep';
import PaymentStep from './components/PaymentStep';
import Admin from './components/admin/Admin';
import SuperAdmin from './components/admin/SuperAdmin';
import CancelBooking from './components/CancelBooking';
import { TenantProvider } from './components/TenantProvider';
import { BusinessRegistration } from './components/BusinessRegistration';
import { BusinessSignUp } from './components/BusinessSignUp';
import { SignupSuccess } from './components/SignupSuccess';
import { NoBusinessFound } from './components/NoBusinessFound';
import { CustomerPortal } from './components/customer/CustomerPortal';
import { GiftCardPurchase } from './components/GiftCardPurchase';
import { LandingPage } from './components/LandingPage';
import { BusinessLogin } from './components/BusinessLogin';
import { AcceptInvite } from './components/AcceptInvite';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import BookingSuccess from './components/BookingSuccess';
import GiftCardSuccess from './components/GiftCardSuccess';
import PaymentCancelled from './components/PaymentCancelled';
import { useTenant } from './lib/tenantContext';
import { CurrencyProvider } from './lib/currencyContext';
import { supabase, Service, ServiceDuration } from './lib/supabase';
import { useBookingCustomization } from './hooks/useBookingCustomization';

type Step = 'welcome' | 'service' | 'duration' | 'addons' | 'specialist' | 'datetime' | 'details' | 'payment' | 'giftcard';
type AppMode = 'landing' | 'login' | 'booking' | 'admin' | 'staff' | 'superadmin' | 'register' | 'signup' | 'signup-success' | 'cancel' | 'customer' | 'accept-invite' | 'forgot-password' | 'reset-password' | 'booking-success' | 'gift-card-success' | 'payment-cancelled';

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

interface BookingState {
  service: Service | null;
  duration: ServiceDuration | null;
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
}

function AppContent() {
  const tenant = useTenant();
  const [appMode, setAppMode] = useState<AppMode>(() => {
    const hash = window.location.hash;
    const path = window.location.pathname;

    if (hash.includes('type=recovery') || hash.includes('type=magiclink')) {
      return 'reset-password';
    }

    if (path === '/superadmin' || path.endsWith('/superadmin')) return 'superadmin';
    if (path === '/admin' || path.endsWith('/admin')) return 'admin';
    if (path === '/staff' || path.endsWith('/staff')) return 'staff';
    if (path === '/accept-invite' || path.endsWith('/accept-invite')) return 'accept-invite';
    if (path === '/forgot-password') return 'forgot-password';
    if (path === '/reset-password') return 'reset-password';
    if (path === '/booking-success') return 'booking-success';
    if (path === '/gift-card-success') return 'gift-card-success';
    if (path === '/payment-cancelled') return 'payment-cancelled';
    if (path === '/login') return 'login';
    if (path === '/register') return 'register';
    if (path === '/signup') return 'signup';
    if (path === '/signup-success') return 'signup-success';
    if (path === '/cancel' || path.endsWith('/cancel')) return 'cancel';
    if (path === '/account' || path.endsWith('/account')) return 'customer';
    if (path === '/') return 'landing';
    return 'booking';
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('type=magiclink')) {
      if (window.location.pathname !== '/reset-password') {
        window.history.replaceState({}, document.title, '/reset-password' + hash);
      }
      setAppMode('reset-password');
    }
  }, []);
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [bookingState, setBookingState] = useState<BookingState>({
    service: null,
    duration: null,
    selectedProducts: [],
    specialistId: null,
    date: '',
    time: '',
    isPairBooking: false,
    customerDetails: {
      name: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  const { getImageForStep } = useBookingCustomization();

  if (appMode === 'superadmin') {
    return <SuperAdmin />;
  }

  if (appMode === 'landing') {
    return (
      <LandingPage
        onSignIn={() => (window.location.href = '/login')}
        onSignUp={() => (window.location.href = '/signup')}
      />
    );
  }

  if (appMode === 'login') {
    return (
      <BusinessLogin
        onBack={() => (window.location.href = '/')}
        onLoginSuccess={() => (window.location.href = '/admin')}
      />
    );
  }

  if (appMode === 'accept-invite') {
    return <AcceptInvite />;
  }

  if (appMode === 'forgot-password') {
    return <ForgotPassword />;
  }

  if (appMode === 'reset-password') {
    return <ResetPassword />;
  }

  if (appMode === 'booking-success') {
    return <BookingSuccess />;
  }

  if (appMode === 'gift-card-success') {
    return <GiftCardSuccess />;
  }

  if (appMode === 'payment-cancelled') {
    return <PaymentCancelled />;
  }

  if (tenant.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">Loading...</div>
      </div>
    );
  }

  if (appMode === 'register') {
    return <BusinessRegistration />;
  }

  if (appMode === 'signup') {
    return <BusinessSignUp />;
  }

  if (appMode === 'signup-success') {
    return <SignupSuccess />;
  }

  // Redirect /admin to /login when no business is found
  if (!tenant.businessId && appMode === 'admin') {
    window.location.href = '/login';
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">Redirecting to login...</div>
      </div>
    );
  }

  if (!tenant.businessId && appMode !== 'register' && appMode !== 'signup' && appMode !== 'landing' && appMode !== 'login') {
    return <NoBusinessFound />;
  }

  const handleServiceSelect = (service: Service, isPairBooking: boolean) => {
    setBookingState({
      ...bookingState,
      service,
      isPairBooking,
    });
    setCurrentStep('duration');
  };

  const handleDurationSelect = async (duration: ServiceDuration) => {
    setBookingState({
      ...bookingState,
      duration,
    });

    if (tenant.businessId && bookingState.service) {
      const hasProducts = await checkForProducts(bookingState.service.id);
      if (hasProducts) {
        setCurrentStep('addons');
      } else {
        setCurrentStep('specialist');
      }
    } else {
      setCurrentStep('addons');
    }
  };

  const checkForProducts = async (serviceId: string): Promise<boolean> => {
    if (!tenant.businessId) return false;

    const { data: assignments } = await supabase
      .from('product_service_assignments')
      .select('product_id')
      .eq('business_id', tenant.businessId)
      .or(`service_id.eq.${serviceId},service_id.is.null`)
      .limit(1);

    return (assignments && assignments.length > 0) || false;
  };

  const handleAddOnsSelect = (selectedProducts: SelectedProduct[]) => {
    setBookingState({
      ...bookingState,
      selectedProducts,
    });
    setCurrentStep('specialist');
  };

  const handleSpecialistSelect = (specialistId: string | null) => {
    setBookingState({
      ...bookingState,
      specialistId,
    });
    setCurrentStep('datetime');
  };

  const handleDateTimeSelect = (date: string, time: string) => {
    setBookingState({
      ...bookingState,
      date,
      time,
    });
    setCurrentStep('details');
  };

  const handleDetailsSubmit = (details: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  }) => {
    setBookingState({
      ...bookingState,
      customerDetails: details,
    });
    setCurrentStep('payment');
  };

  if (appMode === 'admin') {
    return <Admin />;
  }

  if (appMode === 'staff') {
    return <Admin />;
  }

  if (appMode === 'cancel') {
    return <CancelBooking />;
  }

  if (appMode === 'customer') {
    return <CustomerPortal />;
  }

  const getStepKey = (step: Step): string => {
    if (step === 'details') return 'personal_details';
    return step;
  };

  return (
    <BookingLayout imageUrl={getImageForStep(getStepKey(currentStep))}>
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
        <ServiceStep
          onNext={handleServiceSelect}
          onBack={() => setCurrentStep('welcome')}
        />
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
          onBack={() => setCurrentStep('addons')}
        />
      )}

      {currentStep === 'datetime' && (
        <DateTimeStep
          onNext={handleDateTimeSelect}
          onBack={() => setCurrentStep('specialist')}
        />
      )}

      {currentStep === 'details' && (
        <PersonalDetailsStep
          onNext={handleDetailsSubmit}
          onBack={() => setCurrentStep('datetime')}
        />
      )}

      {currentStep === 'payment' &&
        bookingState.service &&
        bookingState.duration && (
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
  );
}

function App() {
  return (
    <TenantProvider>
      <CurrencyProvider>
        <AppContent />
      </CurrencyProvider>
    </TenantProvider>
  );
}

export default App;
