import { useEffect, useState } from 'react';
import { supabase, Service } from '../lib/supabase';
import { ChevronRight, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useTenant } from '../lib/tenantContext';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTheme } from '../lib/themeContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ServiceStepProps {
  onNext: (service: Service, isPairBooking: boolean) => void;
  onBack: () => void;
}

export default function ServiceStep({ onNext, onBack }: ServiceStepProps) {
  const tenant = useTenant();
  const { customization } = useBookingCustomization();
  const { colors } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isPairBooking, setIsPairBooking] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Theme colors with fallbacks
  const primaryColor = colors.primary || '#008374';
  const primaryHoverColor = colors.primaryHover || '#006b5e';
  const secondaryColor = colors.secondary || '#89BA16';

  useEffect(() => {
    if (tenant.businessId) {
      fetchServices();
    }
  }, [tenant.businessId]);

  const fetchServices = async () => {
    if (!tenant.businessId) return;

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', tenant.businessId)
      .order('category')
      .order('display_order')
      .order('name');

    if (error) {
      console.error('Error fetching services:', error);
    } else {
      setServices(data || []);
    }
    setLoading(false);
    setTimeout(() => setIsLoaded(true), 100);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    if (!service.is_pair_massage) {
      setIsPairBooking(false);
    }
  };

  const handleContinue = () => {
    if (selectedService) {
      onNext(selectedService, isPairBooking);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div 
            className="w-10 h-10 border-3 rounded-full animate-spin mx-auto mb-4"
            style={{ 
              borderColor: `${primaryColor}20`,
              borderTopColor: primaryColor 
            }}
          />
          <p style={{ color: colors.textSecondary }}>Loading services...</p>
        </div>
      </div>
    );
  }

  const servicesWithCategory = services.filter(s => s.category && s.category.trim() !== '');
  const servicesWithoutCategory = services.filter(s => !s.category || s.category.trim() === '');

  const groupedServices = servicesWithCategory.reduce((acc, service) => {
    const category = service.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  if (servicesWithoutCategory.length > 0) {
    groupedServices['Other Services'] = servicesWithoutCategory;
  }

  const categories = Object.keys(groupedServices);

  const serviceContent = customization?.service_step || {
    title: "Choose Your Service",
    subtitle: "Select the service you would like to book",
    buttonText: "Continue"
  };

  return (
    <div className="h-full flex flex-col max-h-full">
      {/* Header */}
      <div className={`flex-shrink-0 mb-6 transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <button
          onClick={onBack}
          className="text-sm mb-4 inline-flex items-center transition-colors group"
          style={{ color: colors.textSecondary }}
          onMouseEnter={(e) => e.currentTarget.style.color = colors.textPrimary || '#171717'}
          onMouseLeave={(e) => e.currentTarget.style.color = colors.textSecondary || '#737373'}
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <h2 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: colors.textPrimary }}>{serviceContent.title}</h2>
        <p className="text-lg" style={{ color: colors.textSecondary }}>{serviceContent.subtitle}</p>
      </div>

      {/* Services List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-8 mb-6">
        {categories.map((category, catIndex) => (
          <div 
            key={category}
            className={`transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            style={{ transitionDelay: `${catIndex * 100}ms` }}
          >
            <h3 
              className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2"
              style={{ color: colors.textSecondary }}
            >
              <div 
                className="w-8 h-0.5 rounded-full"
                style={{ background: `linear-gradient(to right, ${primaryColor}, transparent)` }}
              />
              {category}
            </h3>
            <div className="space-y-3">
              {groupedServices[category].map((service, index) => (
                <Card
                  key={service.id}
                  glass
                  onClick={() => handleServiceSelect(service)}
                  className="cursor-pointer p-5 transition-all duration-300 border-2"
                  style={{
                    borderColor: selectedService?.id === service.id ? primaryColor : 'transparent',
                    backgroundColor: selectedService?.id === service.id ? `${primaryColor}08` : undefined,
                    boxShadow: selectedService?.id === service.id ? `0 10px 25px -5px ${primaryColor}15` : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedService?.id !== service.id) {
                      e.currentTarget.style.borderColor = `${primaryColor}40`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedService?.id !== service.id) {
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-1 flex items-center gap-2 flex-wrap" style={{ color: colors.textPrimary }}>
                        <span>{service.name}</span>
                        {service.is_pair_massage && (
                          <Badge 
                            className="text-white border-0 rounded-full px-2.5 py-0.5 text-xs"
                            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryHoverColor})` }}
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Couples
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: colors.textSecondary }}>{service.description}</p>
                    </div>
                    <div 
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300"
                      style={{
                        backgroundColor: selectedService?.id === service.id ? primaryColor : 'transparent',
                        borderColor: selectedService?.id === service.id ? primaryColor : colors.border || '#e5e5e5',
                        transform: selectedService?.id === service.id ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {selectedService?.id === service.id && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={`flex-shrink-0 space-y-4 transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        {selectedService?.is_pair_massage && (
          <Card glass className="p-5" style={{ borderColor: `${primaryColor}30` }}>
            <p className="text-sm font-semibold mb-3" style={{ color: colors.textPrimary }}>Booking Type</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsPairBooking(false)}
                className="px-4 py-3.5 text-sm font-medium border-2 transition-all duration-300 rounded-xl"
                style={{
                  backgroundColor: !isPairBooking ? primaryColor : 'rgba(255,255,255,0.5)',
                  borderColor: !isPairBooking ? primaryColor : colors.border || '#e5e5e5',
                  color: !isPairBooking ? 'white' : colors.textPrimary,
                  boxShadow: !isPairBooking ? `0 10px 25px -5px ${primaryColor}40` : 'none',
                }}
              >
                Individual session
              </button>
              <button
                onClick={() => setIsPairBooking(true)}
                className="px-4 py-3.5 text-sm font-medium border-2 transition-all duration-300 rounded-xl"
                style={{
                  backgroundColor: isPairBooking ? primaryColor : 'rgba(255,255,255,0.5)',
                  borderColor: isPairBooking ? primaryColor : colors.border || '#e5e5e5',
                  color: isPairBooking ? 'white' : colors.textPrimary,
                  boxShadow: isPairBooking ? `0 10px 25px -5px ${primaryColor}40` : 'none',
                }}
              >
                Couples session
              </button>
            </div>
          </Card>
        )}

        <Button
          onClick={handleContinue}
          disabled={!selectedService}
          className="w-full h-14 text-base transition-all duration-300 group text-white disabled:opacity-50"
          size="lg"
          style={{
            background: selectedService 
              ? `linear-gradient(135deg, ${primaryColor}, ${primaryHoverColor})`
              : 'linear-gradient(135deg, #9ca3af, #6b7280)',
            boxShadow: selectedService ? `0 10px 25px -5px ${primaryColor}40` : 'none',
          }}
        >
          {serviceContent.buttonText}
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
