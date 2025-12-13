import { useEffect, useState } from 'react';
import { supabase, ServiceDuration } from '../lib/supabase';
import { ChevronRight, Clock } from 'lucide-react';
import { useTenant } from '../lib/tenantContext';

interface DurationStepProps {
  serviceId: string;
  isPairBooking: boolean;
  onNext: (duration: ServiceDuration) => void;
  onBack: () => void;
}

export default function DurationStep({ serviceId, isPairBooking, onNext, onBack }: DurationStepProps) {
  const tenant = useTenant();
  const [durations, setDurations] = useState<ServiceDuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState<ServiceDuration | null>(null);

  useEffect(() => {
    if (tenant.businessId) {
      fetchDurations();
    }
  }, [serviceId, tenant.businessId]);

  const fetchDurations = async () => {
    if (!tenant.businessId) return;

    const { data, error } = await supabase
      .from('service_durations')
      .select('*')
      .eq('service_id', serviceId)
      .eq('business_id', tenant.businessId)
      .order('duration_minutes');

    if (error) {
      console.error('Error fetching durations:', error);
    } else {
      setDurations(data || []);
    }
    setLoading(false);
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const handleContinue = () => {
    if (selectedDuration) {
      onNext(selectedDuration);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-muted border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-h-full">
      <div className="flex-shrink-0 mb-4">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground text-sm mb-4 inline-flex items-center transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-3xl font-light text-theme-primary mb-2">Select Duration</h2>
        <p className="text-theme-secondary">Choose how long you'd like your session to be</p>
        {isPairBooking && (
          <div className="mt-3 text-sm text-foreground bg-theme-secondary-bg p-3 border border-border rounded-lg">
            Booking for 2 people
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-3 mb-4">
        {durations.map((duration) => (
          <button
            key={duration.id}
            onClick={() => setSelectedDuration(duration)}
            className={`w-full text-left p-5 border transition-all duration-200 rounded-lg ${
              selectedDuration?.id === duration.id
                ? 'border-theme-primary bg-theme-secondary-bg'
                : 'border-border hover:border-theme-primary bg-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-theme-primary bg-opacity-10 flex items-center justify-center flex-shrink-0 rounded-lg">
                  <Clock className="w-5 h-5 text-theme-brand-primary" />
                </div>
                <div>
                  <h3 className="text-foreground font-medium">
                    {duration.duration_minutes} minutes
                  </h3>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    {formatPrice(isPairBooking ? duration.price_cents : duration.price_cents)}
                  </p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                selectedDuration?.id === duration.id
                  ? 'bg-theme-primary border-theme-primary'
                  : 'border-border'
              }`}>
                {selectedDuration?.id === duration.id && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}

        {durations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No duration options available for this service
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <button
          onClick={handleContinue}
          disabled={!selectedDuration}
          className="w-full px-8 py-4 bg-theme-primary text-white text-sm tracking-wide hover:bg-theme-primary-hover transition-colors duration-200 disabled:bg-muted disabled:cursor-not-allowed rounded-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
