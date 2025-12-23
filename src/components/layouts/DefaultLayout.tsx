import { ReactNode, useEffect, useState } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';

interface DefaultLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
}

export default function DefaultLayout({ children, imageUrl, imageAlt = 'Business' }: DefaultLayoutProps) {
  const { businessId } = useTenant();
  const { colors } = useTheme();
  const [businessName, setBusinessName] = useState('');
  const [businessTagline, setBusinessTagline] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Theme colors with fallbacks
  const primaryColor = colors.primary || '#008374';
  const secondaryColor = colors.secondary || '#89BA16';

  useEffect(() => {
    async function fetchBusinessInfo() {
      if (!businessId) return;

      const { data } = await supabase
        .from('businesses')
        .select('name, tagline')
        .eq('id', businessId)
        .maybeSingle();

      if (data) {
        setBusinessName(data.name || '');
        setBusinessTagline(data.tagline || '');
      }
    }

    fetchBusinessInfo();
    setTimeout(() => setIsLoaded(true), 100);
  }, [businessId]);

  return (
    <div 
      className="min-h-screen flex flex-col lg:flex-row lg:h-screen overflow-hidden relative"
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
      
      {/* Left Panel - Image */}
      <div className={`w-full lg:w-2/5 h-56 sm:h-72 lg:h-full relative overflow-hidden order-1 transform transition-all duration-700 ${isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>
        <div style={{ backgroundColor: `${primaryColor}05` }} className="absolute inset-0">
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={imageAlt}
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center px-4 sm:px-8">
                {/* Decorative circles */}
                <div className="relative mb-6">
                  <div 
                    className="absolute inset-0 rounded-full blur-2xl scale-150 animate-pulse-slow"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  />
                  <div 
                    className="w-20 h-20 sm:w-28 sm:h-28 mx-auto rounded-2xl backdrop-blur-sm border border-white/50 flex items-center justify-center relative"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}20)` }}
                  >
                    <svg className="w-10 h-10 sm:w-14 sm:h-14" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                </div>
                {businessName && (
                  <>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight" style={{ color: colors.textPrimary }}>{businessName}</h2>
                    {businessTagline && <p className="text-sm sm:text-base" style={{ color: colors.textSecondary }}>{businessTagline}</p>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Content */}
      <div className={`w-full lg:w-3/5 overflow-y-auto order-2 flex-1 relative z-10 transform transition-all duration-700 delay-200 ${isLoaded ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
        <div className="h-full w-full max-w-2xl mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16">
          {children}
        </div>
      </div>
      <PoweredByBuuk />
    </div>
  );
}
