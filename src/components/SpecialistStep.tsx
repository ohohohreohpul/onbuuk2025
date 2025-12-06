import { useEffect, useState } from 'react';
import { supabase, Specialist } from '../lib/supabase';
import { ChevronRight, User } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTenant } from '../lib/tenantContext';

interface SpecialistStepProps {
  serviceId: string;
  onNext: (specialistId: string | null) => void;
  onBack: () => void;
}

export default function SpecialistStep({ serviceId, onNext, onBack }: SpecialistStepProps) {
  const tenant = useTenant();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const { getText } = useBookingCustomization();

  useEffect(() => {
    if (tenant.businessId) {
      fetchSpecialists();
    }
  }, [serviceId, tenant.businessId]);

  const fetchSpecialists = async () => {
    if (!tenant.businessId) return;

    const { data, error } = await supabase
      .from('specialist_services')
      .select(`
        specialist_id,
        specialists (
          id,
          name,
          bio,
          image_url,
          is_active
        )
      `)
      .eq('service_id', serviceId)
      .eq('business_id', tenant.businessId);

    if (error) {
      console.error('Error fetching specialists:', error);
    } else {
      const specialistData = data
        ?.map((item: any) => item.specialists)
        .filter((s: any) => s && s.is_active) || [];
      setSpecialists(specialistData);
    }
    setLoading(false);
  };

  const handleContinue = () => {
    onNext(selectedSpecialistId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-[#008374] animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-h-full">
      <div className="flex-shrink-0 mb-4">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-black text-sm mb-4 inline-flex items-center transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-3xl font-light text-custom-primary mb-2">{getText('specialist', 'title', 'Choose Your Specialist')}</h2>
        <p className="text-custom-secondary">{getText('specialist', 'subtitle', 'Select a therapist or let us assign one for you')}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 mb-4">
        <button
          onClick={() => setSelectedSpecialistId(null)}
          className={`w-full text-left p-5 border transition-all duration-200 ${
            selectedSpecialistId === null
              ? 'border-[#008374] bg-[#f9f9f9]'
              : 'border-gray-200 hover:border-[#008374] bg-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#008374] bg-opacity-10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#008374]" />
              </div>
              <div>
                <h3 className="text-black font-medium">Anyone Available</h3>
                <p className="text-gray-600 text-sm mt-0.5">
                  We'll assign the first available specialist
                </p>
              </div>
            </div>
            <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ${
              selectedSpecialistId === null
                ? 'bg-custom-primary border-custom'
                : 'border-gray-300'
            }`}>
              {selectedSpecialistId === null && (
                <div className="w-2.5 h-2.5 bg-white"></div>
              )}
            </div>
          </div>
        </button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-white text-xs text-gray-500 uppercase tracking-wider">
              or choose a specialist
            </span>
          </div>
        </div>

        {specialists.map((specialist) => (
          <button
            key={specialist.id}
            onClick={() => setSelectedSpecialistId(specialist.id)}
            className={`w-full text-left p-5 border transition-all duration-200 ${
              selectedSpecialistId === specialist.id
                ? 'border-[#008374] bg-[#f9f9f9]'
                : 'border-gray-200 hover:border-[#008374] bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {specialist.image_url ? (
                    <img
                      src={specialist.image_url}
                      alt={specialist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-black font-medium">{specialist.name}</h3>
                  {specialist.bio && (
                    <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                      {specialist.bio}
                    </p>
                  )}
                </div>
              </div>
              <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 ml-4 ${
                selectedSpecialistId === specialist.id
                  ? 'bg-custom-primary border-custom'
                  : 'border-gray-300'
              }`}>
                {selectedSpecialistId === specialist.id && (
                  <div className="w-2.5 h-2.5 bg-white"></div>
                )}
              </div>
            </div>
          </button>
        ))}

        {specialists.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            No specialists found for this service. We'll assign one for you.
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <button
          onClick={handleContinue}
          className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide bg-custom-primary-hover transition-colors duration-200"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
