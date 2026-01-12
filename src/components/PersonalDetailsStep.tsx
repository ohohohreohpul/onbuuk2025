import { useState, useEffect } from 'react';
import { ChevronRight, User, Mail, Phone, FileText, ArrowRight } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTheme } from '../lib/themeContext';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface PersonalDetailsStepProps {
  onNext: (details: { name: string; email: string; phone: string; notes: string }) => void;
  onBack: () => void;
}

export default function PersonalDetailsStep({ onNext, onBack }: PersonalDetailsStepProps) {
  const { customization } = useBookingCustomization();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const primaryColor = colors.primary || '#008374';
  const primaryHoverColor = colors.primaryHover || '#006d5f';

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  const content = {
    title: customization?.details_step?.title || 'Your Details',
    subtitle: customization?.details_step?.subtitle || 'Please provide your contact information',
    buttonText: customization?.details_step?.buttonText || 'Continue',
    labels: {
      name: customization?.details_step?.labels?.name || 'Full Name',
      email: customization?.details_step?.labels?.email || 'Email Address',
      phone: customization?.details_step?.labels?.phone || 'Phone Number',
      notes: customization?.details_step?.labels?.notes || 'Additional Notes (Optional)'
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      onNext({ name, email, phone, notes });
    }
  };

  const isFormValid = name.trim() && email.trim() && phone.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
          Back
        </button>
        <h2 className="text-3xl font-bold mb-2 tracking-tight" style={{ color: colors.textPrimary }}>{content.title}</h2>
        <p className="text-lg" style={{ color: colors.textSecondary }}>{content.subtitle}</p>
      </div>

      {/* Form Fields - Scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-5 pb-6">
        {/* Name Field */}
        <div className={`transform transition-all duration-500 delay-100 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <label className="block text-sm font-semibold mb-2" style={{ color: colors.textPrimary }}>
            <div className="flex items-center space-x-2">
              <div 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <User className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <span>{content.labels.name}</span>
            </div>
          </label>
          <Card glass className="p-0 overflow-hidden">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-2 transition-all ${
                errors.name ? 'ring-2 ring-red-300' : ''
              }`}
              style={{ 
                color: colors.textPrimary,
                '--tw-ring-color': primaryColor 
              } as any}
              placeholder="Enter your full name"
            />
          </Card>
          {errors.name && (
            <p className="mt-1.5 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Email Field */}
        <div className={`transform transition-all duration-500 delay-150 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <label className="block text-sm font-semibold mb-2" style={{ color: colors.textPrimary }}>
            <div className="flex items-center space-x-2">
              <div 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Mail className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <span>{content.labels.email}</span>
            </div>
          </label>
          <Card glass className="p-0 overflow-hidden">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-2 transition-all ${
                errors.email ? 'ring-2 ring-red-300' : ''
              }`}
              style={{ 
                color: colors.textPrimary,
                '--tw-ring-color': primaryColor 
              } as any}
              placeholder="your.email@example.com"
            />
          </Card>
          {errors.email && (
            <p className="mt-1.5 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Phone Field */}
        <div className={`transform transition-all duration-500 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <label className="block text-sm font-semibold mb-2" style={{ color: colors.textPrimary }}>
            <div className="flex items-center space-x-2">
              <div 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Phone className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <span>{content.labels.phone}</span>
            </div>
          </label>
          <Card glass className="p-0 overflow-hidden">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-2 transition-all ${
                errors.phone ? 'ring-2 ring-red-300' : ''
              }`}
              style={{ 
                color: colors.textPrimary,
                '--tw-ring-color': primaryColor 
              } as any}
              placeholder="+49 123 456789"
            />
          </Card>
          {errors.phone && (
            <p className="mt-1.5 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        {/* Notes Field */}
        <div className={`transform transition-all duration-500 delay-250 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <label className="block text-sm font-semibold mb-2" style={{ color: colors.textPrimary }}>
            <div className="flex items-center space-x-2">
              <div 
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${colors.secondary || '#89BA16'}15` }}
              >
                <FileText className="w-4 h-4" style={{ color: colors.secondary || '#89BA16' }} />
              </div>
              <span>{content.labels.notes}</span>
            </div>
          </label>
          <Card glass className="p-0 overflow-hidden">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-2 transition-all resize-none"
              style={{ 
                color: colors.textPrimary,
                '--tw-ring-color': primaryColor 
              } as any}
              placeholder="Any special requests or health considerations we should know about..."
            />
          </Card>
        </div>
      </div>

      {/* Footer - Sticky at bottom */}
      <div 
        className={`flex-shrink-0 pt-4 mt-auto transform transition-all duration-500 delay-300 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        style={{ 
          borderTopWidth: 1,
          borderTopColor: colors.border || '#e5e5e5',
        }}
      >
        <Button
          onClick={handleContinue}
          disabled={!isFormValid}
          className="w-full h-14 text-base transition-all duration-300 group text-white disabled:opacity-50"
          size="lg"
          style={{
            background: isFormValid 
              ? primaryColor
              : '#9ca3af',
            boxShadow: isFormValid ? `0 4px 14px -3px ${primaryColor}50` : 'none',
          }}
        >
          {content.buttonText}
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
