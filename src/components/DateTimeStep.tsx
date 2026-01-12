import { useState, useEffect } from 'react';
import { ChevronRight, Calendar, Clock, ArrowRight } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTheme } from '../lib/themeContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DateTimeStepProps {
  onNext: (date: string, time: string) => void;
  onBack: () => void;
}

export default function DateTimeStep({ onNext, onBack }: DateTimeStepProps) {
  const { customization } = useBookingCustomization();
  const { colors } = useTheme();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Theme colors with fallbacks
  const primaryColor = colors.primary || '#008374';
  const primaryHoverColor = colors.primaryHover || '#006b5e';
  const secondaryColor = colors.secondary || '#89BA16';

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  const content = {
    title: customization?.datetime_step?.title || 'Choose Date & Time',
    subtitle: customization?.datetime_step?.subtitle || 'Select your preferred appointment slot',
    buttonText: customization?.datetime_step?.buttonText || 'Continue'
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const getNextDays = (count: number) => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDateDisplay = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const timeSlots = generateTimeSlots();
  const availableDays = getNextDays(14);

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      onNext(selectedDate, selectedTime);
    }
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
            <label className="text-sm font-semibold" style={{ color: colors.textPrimary }}>Select Date</label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {availableDays.map((day) => {
              const dateValue = formatDate(day);
              const today = isToday(day);
              const isSelected = selectedDate === dateValue;
              return (
                <Card
                  key={dateValue}
                  glass
                  onClick={() => setSelectedDate(dateValue)}
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
                        (Today)
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
              <label className="text-sm font-semibold" style={{ color: colors.textPrimary }}>Select Time</label>
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

      {/* Continue Button - Sticky */}
      <div 
        className={`flex-shrink-0 pt-4 border-t transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ 
          borderColor: colors.border || '#e5e5e5',
          backgroundColor: colors.backgroundSecondary || '#f8fafc',
          margin: '0 -1.25rem -0.5rem -1.25rem',
          padding: '1rem 1.25rem',
        }}
      >
        <Button
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
          className="w-full h-14 text-base transition-all duration-300 group text-white disabled:opacity-50"
          size="lg"
          style={{
            background: (selectedDate && selectedTime) 
              ? `linear-gradient(135deg, ${primaryColor}, ${primaryHoverColor})`
              : 'linear-gradient(135deg, #9ca3af, #6b7280)',
            boxShadow: (selectedDate && selectedTime) ? `0 10px 25px -5px ${primaryColor}40` : 'none',
          }}
        >
          {content.buttonText}
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
