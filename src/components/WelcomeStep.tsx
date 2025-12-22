import { useState, useEffect } from 'react';
import { User, Calendar, Gift, AlertCircle, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useCustomerAuth } from '../hooks/useCustomerAuth';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { CustomerAuth } from './customer/CustomerAuth';
import { useTenant } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import DOMPurify from 'isomorphic-dompurify';

interface WelcomeStepProps {
  onBookAppointment: () => void;
  onPurchaseGiftCard: () => void;
}

interface WelcomeCard {
  id: string;
  card_order: number;
  icon_type: 'lucide' | 'custom';
  icon_name: string | null;
  icon_url: string | null;
  title: string;
  description: string;
  is_enabled: boolean;
}

export default function WelcomeStep({ onBookAppointment, onPurchaseGiftCard }: WelcomeStepProps) {
  const { customer } = useCustomerAuth();
  const { businessId } = useTenant();
  const { customization, loading: customizationLoading } = useBookingCustomization();
  const [showAuth, setShowAuth] = useState(false);
  const [enableBookings, setEnableBookings] = useState(true);
  const [enableGiftCards, setEnableGiftCards] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showCancelledMessage, setShowCancelledMessage] = useState(false);
  const [showFeatures, setShowFeatures] = useState(true);
  const [useCustomHTML, setUseCustomHTML] = useState(false);
  const [customHTML, setCustomHTML] = useState('');
  const [featureCards, setFeatureCards] = useState<WelcomeCard[]>([]);

  useEffect(() => {
    const fetchFeatureFlags = async () => {
      if (!businessId) {
        setLoading(false);
        return;
      }

      const [businessData, cardsData] = await Promise.all([
        supabase
          .from('businesses')
          .select('enable_bookings, enable_gift_cards, show_welcome_features, use_custom_welcome_html, welcome_custom_html')
          .eq('id', businessId)
          .maybeSingle(),
        supabase
          .from('welcome_feature_cards')
          .select('*')
          .eq('business_id', businessId)
          .eq('is_enabled', true)
          .order('card_order')
      ]);

      if (businessData.data) {
        setEnableBookings(businessData.data.enable_bookings ?? true);
        setEnableGiftCards(businessData.data.enable_gift_cards ?? true);
        setShowFeatures(businessData.data.show_welcome_features ?? true);
        setUseCustomHTML(businessData.data.use_custom_welcome_html ?? false);
        setCustomHTML(businessData.data.welcome_custom_html ?? '');
      }

      if (cardsData.data) {
        setFeatureCards(cardsData.data);
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

  const renderIcon = (card: WelcomeCard) => {
    if (card.icon_type === 'custom' && card.icon_url) {
      return <img src={card.icon_url} alt="icon" className="w-5 h-5" />;
    }
    if (card.icon_type === 'lucide' && card.icon_name) {
      const IconComponent = (LucideIcons as any)[card.icon_name];
      if (IconComponent) {
        return <IconComponent className="w-5 h-5 text-primary" />;
      }
    }
    return <LucideIcons.HelpCircle className="w-5 h-5 text-primary" />;
  };

  if (loading || customizationLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const welcomeContent = customization?.welcome_step || {
    title: "Welcome! Let's get you booked",
    subtitle: "Choose your preferred service and time",
    buttonText: "Get Started"
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="space-y-3 sm:space-y-4 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-foreground tracking-tight">
              {welcomeContent.title}
            </h1>
          </div>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            {welcomeContent.subtitle}
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

      {showFeatures && (
        <>
          {useCustomHTML && customHTML ? (
            <div
              className="welcome-custom-html"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customHTML) }}
            />
          ) : (
            <div className="grid gap-4 sm:gap-6">
              {featureCards.map((card) => (
                <Card key={card.id} className="border-muted">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {renderIcon(card)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-sm sm:text-base">{card.title}</h3>
                        <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

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
            variant="theme"
            size="lg"
            className="w-full h-12"
          >
            <Calendar className="w-5 h-5 mr-2" />
            Book an Appointment
          </Button>
        )}

        {enableGiftCards && (
          <Button
            onClick={onPurchaseGiftCard}
            variant="outline-theme"
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
