import { useEffect, useState } from 'react';
import { supabase, Service } from '../lib/supabase';
import { ChevronRight } from 'lucide-react';
import { useTenant } from '../lib/tenantContext';
import { useBookingCustomization } from '../hooks/useBookingCustomization';

interface ServiceStepProps {
  onNext: (service: Service, isPairBooking: boolean) => void;
  onBack: () => void;
}

export default function ServiceStep({ onNext, onBack }: ServiceStepProps) {
  const tenant = useTenant();
  const { customization } = useBookingCustomization();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isPairBooking, setIsPairBooking] = useState(false);

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
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
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
      <div className="flex-shrink-0 mb-3 sm:mb-4">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground text-sm mb-3 sm:mb-4 inline-flex items-center touch-manipulation transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-2xl sm:text-3xl font-light text-theme-primary mb-2">{serviceContent.title}</h2>
        <p className="text-theme-secondary text-sm sm:text-base">{serviceContent.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 sm:space-y-8 mb-3 sm:mb-4">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4 pb-2 border-b border-border">
              {category}
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {groupedServices[category].map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className={`w-full text-left p-3 sm:p-5 border transition-all duration-200 min-h-[60px] touch-manipulation rounded-lg ${
                    selectedService?.id === service.id
                      ? 'border-theme-primary bg-theme-secondary-bg'
                      : 'border-border hover:border-theme-primary bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-foreground font-medium mb-1 flex items-center gap-2 text-sm sm:text-base flex-wrap">
                        <span>{service.name}</span>
                        {service.is_pair_massage && (
                          <span className="text-xs px-2 py-0.5 bg-theme-primary bg-opacity-10 text-theme-brand-primary border border-theme-primary whitespace-nowrap rounded-md">
                            Couples Available
                          </span>
                        )}
                      </h3>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{service.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1 transition-all ${
                      selectedService?.id === service.id
                        ? 'bg-theme-primary border-theme-primary'
                        : 'border-border'
                    }`}>
                      {selectedService?.id === service.id && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 space-y-4">
        {selectedService?.is_pair_massage && (
          <div className="p-5 border border-border bg-theme-secondary-bg space-y-3 rounded-lg">
            <p className="text-foreground text-sm font-semibold">Booking Type</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsPairBooking(false)}
                className={`px-4 py-3 text-sm font-medium border-2 transition-all duration-200 rounded-lg ${
                  !isPairBooking
                    ? 'bg-theme-primary border-theme-primary text-white'
                    : 'bg-card border-border text-foreground hover:border-theme-primary'
                }`}
              >
                Individual session
              </button>
              <button
                onClick={() => setIsPairBooking(true)}
                className={`px-4 py-3 text-sm font-medium border-2 transition-all duration-200 rounded-lg ${
                  isPairBooking
                    ? 'bg-theme-primary border-theme-primary text-white'
                    : 'bg-card border-border text-foreground hover:border-theme-primary'
                }`}
              >
                Couples session
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedService}
          className="w-full px-8 py-4 bg-theme-primary text-white text-sm tracking-wide hover:bg-theme-primary-hover transition-colors duration-200 disabled:bg-muted disabled:cursor-not-allowed rounded-lg"
        >
          {serviceContent.buttonText}
        </button>
      </div>
    </div>
  );
}
