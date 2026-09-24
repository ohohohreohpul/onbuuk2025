import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Calendar, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTheme } from '../lib/themeContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useBookingText, type Translations } from '../lib/bookingLanguage';

const TEXT: Translations<{
  title: string;
  subtitle: string;
  buttonText: string;
  back: string;
  selectDate: string;
  today: string;
  selectTime: string;
  loading: string;
  noSlots: string;
  loadFailed: string;
  retry: string;
}> = {
  en: {
    title: 'Choose Date & Time',
    subtitle: 'Select your preferred appointment slot',
    buttonText: 'Continue',
    back: 'Back',
    selectDate: 'Select Date',
    today: '(Today)',
    selectTime: 'Select Time',
    loading: 'Checking availability…',
    noSlots: 'No free appointments in the next weeks. Please contact us directly.',
    loadFailed: 'Availability could not be loaded.',
    retry: 'Try again',
  },
  de: {
    title: 'Datum & Uhrzeit wählen',
    subtitle: 'Wunschtermin auswählen',
    buttonText: 'Weiter',
    back: 'Zurück',
    selectDate: 'Datum wählen',
    today: '(Heute)',
    selectTime: 'Uhrzeit wählen',
    loading: 'Freie Termine werden geladen …',
    noSlots: 'In den nächsten Wochen sind keine Termine frei. Bitte kontaktieren Sie uns direkt.',
    loadFailed: 'Freie Termine konnten nicht geladen werden.',
    retry: 'Erneut versuchen',
  },
};

interface DateTimeStepProps {
  /** Chosen duration: decides treatment length and which specialists qualify. */
  durationId: string | null;
  /** Chosen specialist, or null for "anyone". */
  specialistId: string | null;
  onNext: (date: string, time: string) => void;
  onBack: () => void;
}

interface SlotRow {
  slot_date: string;
  slot_time: string;
}

/** How far ahead the booking page looks (the business's booking window may be shorter). */
const DAYS_AHEAD = 28;

export default function DateTimeStep({ durationId, specialistId, onNext, onBack }: DateTimeStepProps) {
  const { businessId } = useTenant();
  const { customization } = useBookingCustomization();
  const { colors } = useTheme();
  const { t, locale } = useBookingText(TEXT);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [slotsByDate, setSlotsByDate] = useState<Map<string, string[]>>(new Map());
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Theme colors with fallbacks
  const primaryColor = colors.primary || '#1A1714';
  const primaryHoverColor = colors.primaryHover || '#2E2926';
  const secondaryColor = colors.secondary || '#A09990';

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  // Free start times come from the server: working hours, treatment length,
  // existing bookings, time off and the booking window are all applied there.
  useEffect(() => {
    if (!businessId || !durationId) return;
    let isCancelled = false;
    setIsLoadingSlots(true);
    setLoadError(false);

    supabase
      .rpc('get_available_slots', {
        p_business_id: businessId,
        p_duration_id: durationId,
        p_specialist_id: specialistId,
        p_days: DAYS_AHEAD,
      })
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error) {
          console.error('Could not load availability:', error);
          setLoadError(true);
          setIsLoadingSlots(false);
          return;
        }
        const grouped = new Map<string, string[]>();
        ((data || []) as SlotRow[]).forEach((row) => {
          const times = grouped.get(row.slot_date) ?? [];
          times.push(row.slot_time.slice(0, 5));
          grouped.set(row.slot_date, times);
        });
        setSlotsByDate(grouped);
        setIsLoadingSlots(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [businessId, durationId, specialistId, reloadKey]);

  const content = {
    title: customization?.datetime_step?.title || t.title,
    subtitle: customization?.datetime_step?.subtitle || t.subtitle,
    buttonText: customization?.datetime_step?.buttonText || t.buttonText
  };

  const availableDays = useMemo(
    () => [...slotsByDate.keys()].sort().map((value) => {
      const [year, month, day] = value.split('-').map(Number);
      return { value, date: new Date(year, month - 1, day) };
    }),
    [slotsByDate]
  );

  const timeSlots = selectedDate ? slotsByDate.get(selectedDate) ?? [] : [];

  const formatDateDisplay = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    };
    return date.toLocaleDateString(locale, options);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };


  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      onNext(selectedDate, selectedTime);
    }
  };

  return (
    <div className="h-full flex flex-col">
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
          {t.back}
        </button>
        <h2 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: colors.textPrimary }}>{content.title}</h2>
        <p className="text-lg" style={{ color: colors.textSecondary }}>{content.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-8 mb-6 pb-4">
        {/* Date Selection */}
        <div className={`transform transition-all duration-500 delay-100 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <Calendar className="w-4 h-4" style={{ color: primaryColor }} />
            </div>
            <label className="text-sm font-semibold" style={{ color: colors.textPrimary }}>{t.selectDate}</label>
          </div>
          {isLoadingSlots && (
            <div className="flex items-center gap-2 py-6 text-sm" style={{ color: colors.textSecondary }}>
              <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
            </div>
          )}
          {!isLoadingSlots && loadError && (
            <div className="py-6 text-sm" style={{ color: colors.textSecondary }}>
              {t.loadFailed}{' '}
              <button type="button" className="underline" onClick={() => setReloadKey((key) => key + 1)}>{t.retry}</button>
            </div>
          )}
          {!isLoadingSlots && !loadError && availableDays.length === 0 && (
            <p className="py-6 text-sm" style={{ color: colors.textSecondary }}>{t.noSlots}</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {!isLoadingSlots && availableDays.map(({ value: dateValue, date: day }) => {
              const today = isToday(day);
              const isSelected = selectedDate === dateValue;
              return (
                <Card
                  key={dateValue}
                  glass
                  onClick={() => {
                    setSelectedDate(dateValue);
                    setSelectedTime('');
                  }}
                  className="cursor-pointer p-4 text-center transition-all duration-300 border-2"
                  style={{
                    borderColor: isSelected ? primaryColor : 'transparent',
                    backgroundColor: isSelected ? `${primaryColor}08` : undefined,
                    boxShadow: isSelected ? `0 10px 25px -5px ${primaryColor}15` : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = `${primaryColor}40`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  <div className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {formatDateDisplay(day)}
                    {today && (
                      <span 
                        className="ml-1.5 text-[10px] font-normal opacity-60"
                        style={{ color: colors.textSecondary }}
                      >
                        {t.today}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Time Selection */}
        {selectedDate && (
          <div className={`transform transition-all duration-500 pb-4 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${secondaryColor}15` }}
              >
                <Clock className="w-4 h-4" style={{ color: secondaryColor }} />
              </div>
              <label className="text-sm font-semibold" style={{ color: colors.textPrimary }}>{t.selectTime}</label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-2">
              {timeSlots.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <Card
                    key={time}
                    glass
                    onClick={() => setSelectedTime(time)}
                    className="cursor-pointer p-3 text-center transition-all duration-300 border-2"
                    style={{
                      borderColor: isSelected ? primaryColor : 'transparent',
                      backgroundColor: isSelected ? `${primaryColor}08` : undefined,
                      boxShadow: isSelected ? `0 10px 25px -5px ${primaryColor}15` : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = `${primaryColor}40`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <div 
                      className="text-sm font-medium"
                      style={{ color: isSelected ? primaryColor : colors.textPrimary }}
                    >
                      {time}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Continue Button - Sticky at bottom */}
      <div 
        className={`flex-shrink-0 pt-4 mt-auto transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ 
          borderTopWidth: 1,
          borderTopColor: colors.border || '#e5e5e5',
        }}
      >
        <Button
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
          className="w-full h-14 text-base transition-all duration-300 group text-white disabled:opacity-50"
          size="lg"
          style={{
            background: (selectedDate && selectedTime) 
              ? primaryColor
              : '#9ca3af',
            boxShadow: (selectedDate && selectedTime) ? `0 4px 14px -3px ${primaryColor}50` : 'none',
          }}
        >
          {content.buttonText}
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
