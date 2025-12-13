import { useState } from 'react';
import { ChevronRight, User, Mail, Phone } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';

interface PersonalDetailsStepProps {
  onNext: (details: { name: string; email: string; phone: string; notes: string }) => void;
  onBack: () => void;
}

export default function PersonalDetailsStep({ onNext, onBack }: PersonalDetailsStepProps) {
  const { customization } = useBookingCustomization();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
        <h2 className="text-3xl font-light text-custom-primary mb-2">{content.title}</h2>
        <p className="text-custom-secondary">{content.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-5 mb-4">
        <div>
          <label className="block text-sm font-semibold text-black mb-2">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-[#008374]" />
              <span>{content.labels.name}</span>
            </div>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-4 py-3 border ${
              errors.name ? 'border-red-300' : 'border-gray-200'
            } focus:outline-none focus:border-[#008374] transition-colors`}
            placeholder="Enter your full name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-black mb-2">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-[#008374]" />
              <span>{content.labels.email}</span>
            </div>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-4 py-3 border ${
              errors.email ? 'border-red-300' : 'border-gray-200'
            } focus:outline-none focus:border-[#008374] transition-colors`}
            placeholder="your.email@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-black mb-2">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-[#008374]" />
              <span>{content.labels.phone}</span>
            </div>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`w-full px-4 py-3 border ${
              errors.phone ? 'border-red-300' : 'border-gray-200'
            } focus:outline-none focus:border-[#008374] transition-colors`}
            placeholder="+49 123 456789"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-black mb-2">
            {content.labels.notes}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#008374] transition-colors resize-none"
            placeholder="Any special requests or health considerations we should know about..."
          />
        </div>
      </div>

      <div className="flex-shrink-0">
        <button
          onClick={handleContinue}
          className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide bg-custom-primary-hover transition-colors duration-200"
        >
          {content.buttonText}
        </button>
      </div>
    </div>
  );
}
