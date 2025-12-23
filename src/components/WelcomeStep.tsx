import { useState, useEffect } from 'react';
import { User, Calendar, Gift, AlertCircle, X, ArrowRight, Sparkles } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useCustomerAuth } from '../hooks/useCustomerAuth';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { CustomerAuth } from './customer/CustomerAuth';
import { useTenant } from '../lib/tenantContext';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
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
  const [isLoaded, setIsLoaded] = useState(false);

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
      setTimeout(() => setIsLoaded(true), 100);
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
        return <IconComponent className="w-5 h-5 text-[#008374]" />;
      }
    }
    return <LucideIcons.HelpCircle className="w-5 h-5 text-[#008374]" />;
  };

  if (loading || customizationLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#008374]/20 border-t-[#008374] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const welcomeContent = customization?.welcome_step || {
    title: "Welcome! Let's get you booked",
    subtitle: "Choose your preferred service and time",
    buttonText: "Get Started"
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row items-start justify-between gap-4 transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <div className="space-y-3 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {welcomeContent.title}
            </h1>
          </div>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-lg">
            {welcomeContent.subtitle}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleAccountClick}
          className="self-start sm:self-auto hover:bg-[#008374]/10 hover:border-[#008374] hover:text-[#008374] transition-all duration-200"
        >
          <User className="w-4 h-4 mr-2" />
          {customer ? 'My Account' : 'Sign In'}
        </Button>
      </div>

      {showAuth && <CustomerAuth onClose={() => setShowAuth(false)} />}

      {showCancelledMessage && (
        <Alert className="relative bg-yellow-50/80 backdrop-blur-sm border-yellow-200 animate-fade-in">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Payment Cancelled</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Your payment was cancelled. No charges were made. You can try booking again whenever you're ready.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-6 w-6 hover:bg-yellow-100"
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
            <div className={`grid gap-4 transform transition-all duration-500 delay-100 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              {featureCards.map((card, index) => (
                <Card 
                  key={card.id} 
                  glass
                  className="group hover-lift border-transparent hover:border-[#008374]/20"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#008374]/10 to-[#89BA16]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        {renderIcon(card)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-foreground">{card.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
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

      {/* Action Buttons */}
      <div className={`pt-4 space-y-4 transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        {!enableBookings && !enableGiftCards && (
          <Alert className="bg-amber-50/80 backdrop-blur-sm border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Online booking is temporarily unavailable</AlertTitle>
            <AlertDescription className="text-amber-700">
              Please contact us directly to make a booking or purchase a gift card.
            </AlertDescription>
          </Alert>
        )}

        {enableBookings && customization?.welcome_step?.showBookingButton !== false && (
          <Button
            onClick={onBookAppointment}
            className="w-full h-14 text-base bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-xl hover:shadow-[#008374]/25 transition-all duration-300 group"
            size="lg"
          >
            <Calendar className="w-5 h-5 mr-2" />
            {customization?.welcome_step?.bookingButtonText || 'Book an Appointment'}
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        )}

        {enableGiftCards && customization?.welcome_step?.showGiftCardButton !== false && (
          <Button
            onClick={onPurchaseGiftCard}
            variant="outline"
            className="w-full h-14 text-base border-2 border-[#008374] text-[#008374] hover:bg-[#008374] hover:text-white hover:shadow-lg hover:shadow-[#008374]/25 transition-all duration-300 group"
            size="lg"
          >
            <Gift className="w-5 h-5 mr-2" />
            {customization?.welcome_step?.giftCardButtonText || 'Purchase a Gift Card'}
            <Sparkles className="w-4 h-4 ml-2 group-hover:rotate-12 transition-transform" />
          </Button>
        )}
      </div>
    </div>
  );
}
