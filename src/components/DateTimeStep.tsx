import { useState } from 'react';
import { ChevronRight, Calendar, Clock } from 'lucide-react';

interface DateTimeStepProps {
  onNext: (date: string, time: string) => void;
  onBack: () => void;
}

export default function DateTimeStep({ onNext, onBack }: DateTimeStepProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

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

  const timeSlots = generateTimeSlots();
  const availableDays = getNextDays(14);

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      onNext(selectedDate, selectedTime);
    }
  };

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
        <h2 className="text-3xl font-light text-custom-primary mb-2">Choose Date & Time</h2>
        <p className="text-custom-secondary">Select your preferred appointment slot</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Calendar className="w-4 h-4 text-[#008374]" />
            <label className="text-sm font-semibold text-black">Date</label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableDays.map((day) => {
              const dateValue = formatDate(day);
              return (
                <button
                  key={dateValue}
                  onClick={() => setSelectedDate(dateValue)}
                  className={`p-3 border text-left transition-all duration-200 ${
                    selectedDate === dateValue
                      ? 'border-[#008374] bg-[#f9f9f9]'
                      : 'border-gray-200 hover:border-[#008374] bg-white'
                  }`}
                >
                  <div className="text-sm font-medium text-black">
                    {formatDateDisplay(day)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedDate && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Clock className="w-4 h-4 text-[#008374]" />
              <label className="text-sm font-semibold text-black">Time</label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {timeSlots.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`p-3 border text-center transition-all duration-200 ${
                    selectedTime === time
                      ? 'border-[#008374] bg-[#f9f9f9]'
                      : 'border-gray-200 hover:border-[#008374] bg-white'
                  }`}
                >
                  <div className="text-sm text-black">{time}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <button
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
          className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide bg-custom-primary-hover transition-colors duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
