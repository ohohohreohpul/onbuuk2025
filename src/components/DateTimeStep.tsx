import { useState, useEffect } from 'react';
import { ChevronRight, Calendar, Clock, ArrowRight } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DateTimeStepProps {
  onNext: (date: string, time: string) => void;
  onBack: () => void;
}

export default function DateTimeStep({ onNext, onBack }: DateTimeStepProps) {
  const { customization } = useBookingCustomization();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

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
          className="text-muted-foreground hover:text-foreground text-sm mb-4 inline-flex items-center transition-colors group"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <h2 className="text-3xl font-bold text-foreground mb-2 tracking-tight">{content.title}</h2>
        <p className="text-muted-foreground text-lg">{content.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-8 mb-6">
        {/* Date Selection */}
        <div className={`transform transition-all duration-500 delay-100 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-[#008374]/10">
              <Calendar className="w-4 h-4 text-[#008374]" />
            </div>
            <label className="text-sm font-semibold text-foreground">Select Date</label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {availableDays.map((day) => {
              const dateValue = formatDate(day);
              const today = isToday(day);
              return (
                <Card
                  key={dateValue}
                  glass
                  onClick={() => setSelectedDate(dateValue)}
                  className={`cursor-pointer p-4 text-center transition-all duration-300 border-2 ${
                    selectedDate === dateValue
                      ? 'border-[#008374] bg-[#008374]/5 shadow-lg shadow-[#008374]/10'
                      : 'border-transparent hover:border-[#008374]/30'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">
                    {formatDateDisplay(day)}
                  </div>
                  {today && (
                    <div className="text-xs text-[#008374] mt-1 font-medium">Today</div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Time Selection */}
        {selectedDate && (
          <div className={`transform transition-all duration-500 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[#89BA16]/10">
                <Clock className="w-4 h-4 text-[#89BA16]" />
              </div>
              <label className="text-sm font-semibold text-foreground">Select Time</label>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {timeSlots.map((time) => (
                <Card
                  key={time}
                  glass
                  onClick={() => setSelectedTime(time)}
                  className={`cursor-pointer p-3 text-center transition-all duration-300 border-2 ${
                    selectedTime === time
                      ? 'border-[#008374] bg-[#008374]/5 shadow-lg shadow-[#008374]/10'
                      : 'border-transparent hover:border-[#008374]/30'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    selectedTime === time ? 'text-[#008374]' : 'text-foreground'
                  }`}>
                    {time}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <div className={`flex-shrink-0 transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <Button
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
          className="w-full h-14 text-base bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-xl hover:shadow-[#008374]/25 transition-all duration-300 group disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none"
          size="lg"
        >
          {content.buttonText}
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
