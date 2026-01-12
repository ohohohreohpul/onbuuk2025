import { ReactNode, useState, useEffect } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';
import { Check, Clock, User, Calendar } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';

interface SplitPanelLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageMobile?: string;
  imageTablet?: string;
  imageDesktop?: string;
  imageAlt?: string;
  bookingSummary?: {
    service?: string;
    serviceType?: string;
    duration?: string;
    specialist?: string;
    date?: string;
    time?: string;
    total?: string;
  };
}

export default function SplitPanelLayout({ children, imageUrl, imageMobile, imageTablet, imageDesktop, imageAlt, bookingSummary }: SplitPanelLayoutProps) {
  const { colors } = useTheme();
  const [isLoaded, setIsLoaded] = useState(false);

  // Theme colors with fallbacks
  const primaryColor = colors.primary || '#008374';
  const secondaryColor = colors.secondary || '#89BA16';

  // Determine which image to show based on screen size
  const displayImage = imageDesktop || imageTablet || imageMobile || imageUrl;

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  return (
    <div 
      className="h-screen flex flex-col lg:flex-row relative overflow-hidden"
      style={{ backgroundColor: colors.backgroundSecondary || '#f8fafc' }}
    >
      {/* Background decorations */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `
            radial-gradient(at 40% 20%, ${primaryColor}15 0px, transparent 50%),
            radial-gradient(at 80% 0%, ${secondaryColor}10 0px, transparent 50%),
            radial-gradient(at 0% 50%, ${primaryColor}10 0px, transparent 50%),
            radial-gradient(at 80% 50%, ${secondaryColor}08 0px, transparent 50%),
            radial-gradient(at 0% 100%, ${primaryColor}12 0px, transparent 50%)
          `
        }}
      />
      
      {/* Main Content - Scrollable */}
      <div className={`flex-1 overflow-y-auto order-2 lg:order-1 relative z-10 transform transition-all duration-700 ${isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12 min-h-full">
          {children}
        </div>
      </div>

      {/* Sidebar - FIXED, does not scroll */}
      <aside className={`w-full lg:w-[380px] lg:h-screen lg:overflow-y-auto order-1 lg:order-2 relative transform transition-all duration-700 delay-200 flex-shrink-0 ${isLoaded ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
        <div 
          className="h-full backdrop-blur-xl border-b lg:border-b-0 lg:border-l"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderColor: `${colors.border}50` || 'rgba(229, 231, 235, 0.5)'
          }}
        >
          <div className="p-6 lg:p-8 space-y-6">
            {/* Custom Image */}
            {displayImage && (
              <div className="rounded-xl overflow-hidden shadow-lg">
                <img 
                  src={displayImage} 
                  alt={imageAlt || 'Booking'} 
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: colors.textPrimary }}>Booking Summary</h2>
              <p className="text-sm" style={{ color: colors.textSecondary }}>Review your selection</p>
            </div>

            {/* Summary Items */}
            <div className="space-y-4">
              {/* Service */}
              <SummaryItem
                isCompleted={!!bookingSummary?.service}
                icon={<Calendar className="w-4 h-4" />}
                label="Service"
                value={bookingSummary?.service}
                extra={bookingSummary?.serviceType}
                primaryColor={primaryColor}
                colors={colors}
              />

              {/* Duration */}
              <SummaryItem
                isCompleted={!!bookingSummary?.duration}
                icon={<Clock className="w-4 h-4" />}
                label="Duration"
                value={bookingSummary?.duration}
                primaryColor={primaryColor}
                colors={colors}
              />

              {/* Specialist */}
              <SummaryItem
                isCompleted={!!bookingSummary?.specialist}
                icon={<User className="w-4 h-4" />}
                label="Specialist"
                value={bookingSummary?.specialist}
                primaryColor={primaryColor}
                colors={colors}
              />

              {/* Date & Time */}
              <SummaryItem
                isCompleted={!!(bookingSummary?.date && bookingSummary?.time)}
                icon={<Calendar className="w-4 h-4" />}
                label="Date & Time"
                value={bookingSummary?.date && bookingSummary?.time ? `${bookingSummary.date} at ${bookingSummary.time}` : undefined}
                primaryColor={primaryColor}
                colors={colors}
              />

              {/* Total */}
              {bookingSummary?.total && (
                <div className="pt-4 mt-4" style={{ borderTopColor: colors.border || '#e5e5e5', borderTopWidth: 1 }}>
                  <div 
                    className="flex justify-between items-center p-4 rounded-xl"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
                  >
                    <p className="text-base font-semibold text-white">Total</p>
                    <p className="text-2xl font-bold text-white">{bookingSummary.total}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Helper text */}
            <div className="pt-4">
              <div 
                className="p-4 rounded-xl"
                style={{ backgroundColor: colors.backgroundSecondary || '#f8fafc', borderColor: colors.border || '#e5e5e5', borderWidth: 1 }}
              >
                <p className="text-xs text-center" style={{ color: colors.textSecondary }}>
                  Complete all steps to confirm your booking
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <PoweredByBuuk />
    </div>
  );
}

function SummaryItem({ 
  isCompleted, 
  icon, 
  label, 
  value, 
  extra,
  primaryColor,
  colors
}: { 
  isCompleted: boolean; 
  icon: React.ReactNode; 
  label: string; 
  value?: string;
  extra?: string;
  primaryColor: string;
  colors: any;
}) {
  return (
    <div 
      className="p-4 rounded-xl transition-all duration-300"
      style={{
        backgroundColor: isCompleted ? `${primaryColor}08` : colors.backgroundSecondary || '#f8fafc',
        borderColor: isCompleted ? `${primaryColor}30` : colors.border || '#e5e5e5',
        borderWidth: 1,
      }}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: isCompleted ? primaryColor : colors.border || '#e5e5e5',
            color: isCompleted ? 'white' : colors.textSecondary || '#737373',
          }}
        >
          {isCompleted ? <Check className="w-4 h-4" /> : icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.textSecondary }}>{label}</p>
          {value ? (
            <div className="mt-1">
              <p className="font-semibold truncate" style={{ color: colors.textPrimary }}>{value}</p>
              {extra && (
                <span 
                  className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  {extra}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm mt-1 italic" style={{ color: colors.textSecondary }}>Not selected</p>
          )}
        </div>
      </div>
    </div>
  );
}
