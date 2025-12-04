import { useState } from 'react';
import { ChevronRight, User, Mail, Phone } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';

interface PersonalDetailsStepProps {
  onNext: (details: { name: string; email: string; phone: string; notes: string }) => void;
  onBack: () => void;
}

export default function PersonalDetailsStep({ onNext, onBack }: PersonalDetailsStepProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const { getText } = useBookingCustomization();

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
          className="text-stone-500 hover:text-stone-700 text-sm mb-4 inline-flex items-center"
        >
          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
          Back
        </button>
        <h2 className="text-3xl font-light text-custom-primary mb-2">{getText('personal_details', 'title', 'Your Details')}</h2>
        <p className="text-custom-secondary">{getText('personal_details', 'subtitle', 'Please provide your contact information')}</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-5 mb-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Full Name</span>
            </div>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full px-4 py-3 border ${
              errors.name ? 'border-red-300' : 'border-stone-200'
            } focus:outline-none focus:border-stone-800 transition-colors`}
            placeholder="Enter your full name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>Email Address</span>
            </div>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-4 py-3 border ${
              errors.email ? 'border-red-300' : 'border-stone-200'
            } focus:outline-none focus:border-stone-800 transition-colors`}
            placeholder="your.email@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4" />
              <span>Phone Number</span>
            </div>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`w-full px-4 py-3 border ${
              errors.phone ? 'border-red-300' : 'border-stone-200'
            } focus:outline-none focus:border-stone-800 transition-colors`}
            placeholder="+49 123 456789"
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Additional Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 transition-colors resize-none"
            placeholder="Any special requests or health considerations we should know about..."
          />
        </div>
      </div>

      <div className="flex-shrink-0">
        <button
          onClick={handleContinue}
          className="w-full px-8 py-4 bg-custom-primary text-white text-sm tracking-wide bg-custom-primary-hover transition-colors duration-200"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  );
}
