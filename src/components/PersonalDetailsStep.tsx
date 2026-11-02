import { useState, useEffect } from 'react';
import { ChevronRight, User, Mail, Phone, FileText, ArrowRight, Cake } from 'lucide-react';
import { useBookingCustomization } from '../hooks/useBookingCustomization';
import { useTheme } from '../lib/themeContext';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useBookingText, type Translations, customOr } from '../lib/bookingLanguage';
import { isValidBirthday, type CustomerDetails } from '../lib/customerDetails';

const TEXT: Translations<{
  back: string;
  title: string;
  subtitle: string;
  continue: string;
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  notesLabel: string;
  nameRequired: string;
  emailRequired: string;
  emailInvalid: string;
  phoneRequired: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  notesPlaceholder: string;
  birthdayLabel: string;
  birthdayHint: string;
  birthdayInvalid: string;
  newsletterLabel: string;
  existingCustomerNotice: string;
}> = {
  en: {
    back: 'Back',
    title: 'Your Details',
    subtitle: 'Please provide your contact information',
    continue: 'Continue',
    nameLabel: 'Full Name',
    emailLabel: 'Email Address',
    phoneLabel: 'Phone Number',
    notesLabel: 'Additional Notes (Optional)',
    nameRequired: 'Name is required',
    emailRequired: 'Email is required',
    emailInvalid: 'Please enter a valid email',
    phoneRequired: 'Phone number is required',
    namePlaceholder: 'Enter your full name',
    emailPlaceholder: 'your.email@example.com',
    notesPlaceholder: 'Any special requests or health considerations we should know about...',
    birthdayLabel: 'Birthday (optional)',
    birthdayHint: 'So we can send you a little birthday surprise.',
    birthdayInvalid: 'Please enter a valid date',
    newsletterLabel: 'Yes, I would like to receive news and offers by email.',
    existingCustomerNotice: 'We may also email you about similar offers. You can object to this at any time, e.g. via the link in every email.',
  },
  de: {
    back: 'Zurück',
    title: 'Persönliche Angaben',
    subtitle: 'Bitte Kontaktdaten angeben',
    continue: 'Weiter',
    nameLabel: 'Vollständiger Name',
    emailLabel: 'E-Mail-Adresse',
    phoneLabel: 'Telefonnummer',
    notesLabel: 'Anmerkungen (optional)',
    nameRequired: 'Bitte Namen angeben',
    emailRequired: 'Bitte E-Mail-Adresse angeben',
    emailInvalid: 'Bitte eine gültige E-Mail-Adresse eingeben',
    phoneRequired: 'Bitte Telefonnummer angeben',
    namePlaceholder: 'Vor- und Nachname',
    emailPlaceholder: 'name@beispiel.de',
    notesPlaceholder: 'Besondere Wünsche oder gesundheitliche Hinweise, die wir kennen sollten …',
    birthdayLabel: 'Geburtstag (optional)',
    birthdayHint: 'Damit wir Ihnen zum Geburtstag eine kleine Überraschung schicken können.',
    birthdayInvalid: 'Bitte ein gültiges Datum eingeben',
    newsletterLabel: 'Ja, ich möchte Neuigkeiten und Angebote per E-Mail erhalten.',
    existingCustomerNotice: 'Wir können Sie per E-Mail auch über ähnliche Angebote informieren. Dem können Sie jederzeit widersprechen, z. B. über den Link in jeder E-Mail.',
  },
  th: {
    back: 'ย้อนกลับ',
    title: 'ข้อมูลของคุณ',
    subtitle: 'กรุณากรอกข้อมูลติดต่อ',
    continue: 'ดำเนินการต่อ',
    nameLabel: 'ชื่อ-นามสกุล',
    emailLabel: 'อีเมล',
    phoneLabel: 'เบอร์โทรศัพท์',
    notesLabel: 'หมายเหตุเพิ่มเติม (ไม่บังคับ)',
    nameRequired: 'กรุณากรอกชื่อ',
    emailRequired: 'กรุณากรอกอีเมล',
    emailInvalid: 'กรุณากรอกอีเมลที่ถูกต้อง',
    phoneRequired: 'กรุณากรอกเบอร์โทรศัพท์',
    namePlaceholder: 'กรอกชื่อ-นามสกุล',
    emailPlaceholder: 'your.email@example.com',
    notesPlaceholder: 'คำขอพิเศษหรือข้อมูลด้านสุขภาพที่ควรแจ้งให้เราทราบ...',
    birthdayLabel: 'วันเกิด (ไม่บังคับ)',
    birthdayHint: 'เพื่อให้เราส่งเซอร์ไพรส์เล็ก ๆ ในวันเกิดของคุณ',
    birthdayInvalid: 'กรุณากรอกวันที่ที่ถูกต้อง',
    newsletterLabel: 'ต้องการรับข่าวสารและข้อเสนอทางอีเมล',
    existingCustomerNotice: 'เราอาจส่งอีเมลแจ้งข้อเสนอที่คล้ายกันให้คุณ คุณปฏิเสธได้ทุกเมื่อ เช่น ผ่านลิงก์ในทุกอีเมล',
  },
};

interface PersonalDetailsStepProps {
  onNext: (details: CustomerDetails) => void;
  onBack: () => void;
}

export default function PersonalDetailsStep({ onNext, onBack }: PersonalDetailsStepProps) {
  const { customization } = useBookingCustomization();
  const { colors } = useTheme();
  const { t } = useBookingText(TEXT);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [birthday, setBirthday] = useState('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const primaryColor = colors.primary || '#1A1714';
  const primaryHoverColor = colors.primaryHover || '#2E2926';

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  const content = {
    title: customOr(customization?.details_step?.title, t.title, TEXT.en.title),
    subtitle: customOr(customization?.details_step?.subtitle, t.subtitle, TEXT.en.subtitle),
    buttonText: customOr(customization?.details_step?.buttonText, t.continue, TEXT.en.continue),
    labels: {
      name: customOr(customization?.details_step?.labels?.name, t.nameLabel, TEXT.en.nameLabel),
      email: customOr(customization?.details_step?.labels?.email, t.emailLabel, TEXT.en.emailLabel),
      phone: customOr(customization?.details_step?.labels?.phone, t.phoneLabel, TEXT.en.phoneLabel),
      notes: customOr(customization?.details_step?.labels?.notes, t.notesLabel, TEXT.en.notesLabel)
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = t.nameRequired;
    }

    if (!email.trim()) {
      newErrors.email = t.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t.emailInvalid;
    }

    if (!phone.trim()) {
      newErrors.phone = t.phoneRequired;
    }

    if (birthday && !isValidBirthday(birthday)) {
      newErrors.birthday = t.birthdayInvalid;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      onNext({ name, email, phone, notes, birthday, newsletterOptIn });
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
          {t.back}
        </button>
        <h2 className="text-3xl font-semibold mb-2 tracking-tight" style={{ color: colors.textPrimary }}>{content.title}</h2>
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
              placeholder={t.namePlaceholder}
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
              placeholder={t.emailPlaceholder}
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
                style={{ backgroundColor: `${colors.secondary || '#A09990'}15` }}
              >
                <FileText className="w-4 h-4" style={{ color: colors.secondary || '#A09990' }} />
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
              placeholder={t.notesPlaceholder}
            />
          </Card>
        </div>

        {/* Birthday Field */}
        <div className={`transform transition-all duration-500 delay-300 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <label htmlFor="booking-birthday" className="block text-sm font-semibold mb-2" style={{ color: colors.textPrimary }}>
            <div className="flex items-center space-x-2">
              <div
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${colors.secondary || '#A09990'}15` }}
              >
                <Cake className="w-4 h-4" style={{ color: colors.secondary || '#A09990' }} />
              </div>
              <span>{t.birthdayLabel}</span>
            </div>
          </label>
          <Card glass className="p-0 overflow-hidden">
            <input
              id="booking-birthday"
              type="date"
              value={birthday}
              max={new Date().toISOString().slice(0, 10)}
              min="1900-01-01"
              onChange={(e) => setBirthday(e.target.value)}
              className={`w-full px-4 py-3 bg-transparent border-0 focus:outline-none focus:ring-2 transition-all ${
                errors.birthday ? 'ring-2 ring-red-300' : ''
              }`}
              style={{
                color: colors.textPrimary,
                '--tw-ring-color': primaryColor
              } as any}
            />
          </Card>
          {errors.birthday
            ? <p className="mt-1.5 text-sm text-red-600">{errors.birthday}</p>
            : <p className="mt-1.5 text-sm" style={{ color: colors.textSecondary }}>{t.birthdayHint}</p>}
        </div>

        {/* Newsletter consent (unticked by default; leads to a double opt-in email) */}
        <div className={`space-y-2 transform transition-all duration-500 delay-300 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <label className="flex items-start gap-3 cursor-pointer text-sm" style={{ color: colors.textPrimary }}>
            <input
              type="checkbox"
              checked={newsletterOptIn}
              onChange={(e) => setNewsletterOptIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded"
              style={{ accentColor: primaryColor }}
            />
            <span>{t.newsletterLabel}</span>
          </label>
          <p className="text-xs leading-relaxed" style={{ color: colors.textSecondary }}>{t.existingCustomerNotice}</p>
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
