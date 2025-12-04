import { useEffect, useState } from 'react';
import { supabase, Service } from '../lib/supabase';
import { ChevronRight } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTenant } from '../lib/tenantContext';

interface ServiceStepProps {
  onNext: (service: Service, isPairBooking: boolean) => void;
  onBack: () => void;
}

export default function ServiceStep({ onNext, onBack }: ServiceStepProps) {
  const tenant = useTenant();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isPairBooking, setIsPairBooking] = useState(false);
  const { getText } = useBookingCustomization();

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
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
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

  return (
    <div className="h-full flex flex-col max-h-full">
      <div className="flex-shrink-0 mb-3 sm:mb-4">
        <button
          onClick={onBack}
          className="text-stone-500 hover:text-stone-700 text-sm mb-3 sm:mb-4 inline-flex items-center touch-manipulation"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-2xl sm:text-3xl font-light text-custom-primary mb-2">{getText('service', 'title', 'Choose Your Service')}</h2>
        <p className="text-custom-secondary text-sm sm:text-base">{getText('service', 'subtitle', 'Select the treatment that best suits your needs')}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 sm:space-y-8 mb-3 sm:mb-4">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-base sm:text-lg font-medium text-stone-800 mb-3 sm:mb-4 pb-2 border-b border-stone-200">
              {category}
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {groupedServices[category].map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className={`w-full text-left p-3 sm:p-5 border transition-all duration-200 min-h-[60px] touch-manipulation ${
                    selectedService?.id === service.id
                      ? 'border-stone-800 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-stone-800 font-medium mb-1 flex items-center gap-2 text-sm sm:text-base flex-wrap">
                        <span>{service.name}</span>
                        {service.is_pair_massage && (
                          <span className="text-xs px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full whitespace-nowrap">
                            Couples Available
                          </span>
                        )}
                      </h3>
                      <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">{service.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-1 ${
                      selectedService?.id === service.id
                        ? 'bg-custom-primary border-custom'
                        : 'border-stone-300'
                    }`}>
                      {selectedService?.id === service.id && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
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
          <div className="p-5 border border-stone-200 bg-stone-50 space-y-3">
            <p className="text-stone-700 text-sm font-medium">Booking Type</p>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="booking-type"
                  checked={!isPairBooking}
                  onChange={() => setIsPairBooking(false)}
                  className="w-4 h-4 text-stone-800 focus:ring-stone-500"
                />
                <span className="text-stone-700 text-sm">Individual session</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="booking-type"
                  checked={isPairBooking}
                  onChange={() => setIsPairBooking(true)}
                  className="w-4 h-4 text-stone-800 focus:ring-stone-500"
                />
                <span className="text-stone-700 text-sm">Couples session (for 2 people)</span>
              </label>
            </div>
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedService}
          className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide bg-custom-primary-hover transition-colors duration-200 disabled:bg-stone-300 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
