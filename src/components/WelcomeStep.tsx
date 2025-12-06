import { useState, useEffect } from 'react';
import { User, Calendar, Gift, AlertCircle, Check, Clock, CheckCircle2, X } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useCustomerAuth } from '../hooks/useCustomerAuth';
import { CustomerAuth } from './customer/CustomerAuth';
import { useTenant } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

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
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="space-y-3 sm:space-y-4 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground tracking-tight">
              {getText('welcome', 'title', 'Book Your Appointment')}
            </h1>
          </div>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            {getText('welcome', 'description', 'Select from our available services and choose a time that works best for you. We look forward to serving you!')}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleAccountClick}
          className="self-start sm:self-auto"
        >
          <User className="w-4 h-4 mr-2" />
          {customer ? 'My Account' : 'Sign In'}
        </Button>
      </div>

      {showAuth && <CustomerAuth onClose={() => setShowAuth(false)} />}

      {showCancelledMessage && (
        <Alert className="relative">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Cancelled</AlertTitle>
          <AlertDescription>
            Your payment was cancelled. No charges were made. You can try booking again whenever you're ready.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6"
            onClick={() => setShowCancelledMessage(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      <div className="grid gap-4 sm:gap-6">
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-sm sm:text-base">Professional Service</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Our experienced team is dedicated to providing you with exceptional service.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-sm sm:text-base">Flexible Scheduling</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Choose the time that works best for you with our easy online booking system.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-sm sm:text-base">Easy Process</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Simple and straightforward booking in just a few steps. Confirmation sent instantly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pt-4 sm:pt-6 space-y-3 sm:space-y-4">
        {!enableBookings && !enableGiftCards && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Online booking is temporarily unavailable</AlertTitle>
            <AlertDescription>
              Please contact us directly to make a booking or purchase a gift card.
            </AlertDescription>
          </Alert>
        )}

        {enableBookings && (
          <Button
            onClick={onBookAppointment}
            size="lg"
            className="w-full h-12"
          >
            <Calendar className="w-5 h-5 mr-2" />
            {getText('welcome', 'button', 'Book an Appointment')}
          </Button>
        )}

        {enableGiftCards && (
          <Button
            onClick={onPurchaseGiftCard}
            variant="outline"
            size="lg"
            className="w-full h-12"
          >
            <Gift className="w-5 h-5 mr-2" />
            Purchase a Gift Card
          </Button>
        )}
      </div>
    </div>
  );
}
